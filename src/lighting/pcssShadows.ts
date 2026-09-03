/**
 * Percentage-Closer Soft Shadows (PCSS) für die Sonnen-DirectionalLight.
 * Port des Three.js-Beispiels webgl_shadowmap_pcss (MIT): Blocker-Suche + variable Penumbra.
 * Erfordert BasicShadowMap (Roh-Tiefenwerte aus der Shadow-Map).
 */
import * as THREE from 'three'

/** Slider 0,5…8 → physische Lichtfläche (cm) für die PCSS-Penumbra. */
export const PCSS_LIGHT_WORLD_SIZE_MIN_CM = 0.8
export const PCSS_LIGHT_WORLD_SIZE_MAX_CM = 28

/** Normalisierte Near-Plane in Shadow-Tiefenraum (0…1) — Suchradius für Blocker. */
export const PCSS_NEAR_PLANE = 0.002

/**
 * Penumbra-Verstärker für Ortho-Shadow-Maps (statt Perspektiv-`NEAR/z`).
 * Ohne ihn ist der Weichheit-Slider praktisch tot; zu groß (24+) wirkt fransig.
 * Softness-Default 2,5 hält den Kontakt ruhig — Slider 0,5…8 steuert die Breite.
 */
export const PCSS_PENUMBRA_SCALE = 8

/** Mehr Samples = weniger sichtbares Poisson-Raster in der Penumbra (Three.js-Beispiel: 17). */
export const PCSS_NUM_SAMPLES = 32
export const PCSS_NUM_RINGS = 14

const PCSS_NUM_SAMPLES_INTERNAL = PCSS_NUM_SAMPLES
const PCSS_NUM_RINGS_INTERNAL = PCSS_NUM_RINGS

const PCSS_GLSL_HELPERS = `
#define PCSS_NUM_SAMPLES ${PCSS_NUM_SAMPLES_INTERNAL}
#define PCSS_NUM_RINGS ${PCSS_NUM_RINGS_INTERNAL}
#define PCSS_BLOCKER_SEARCH_NUM_SAMPLES PCSS_NUM_SAMPLES

vec2 pcssPoissonDisk[PCSS_NUM_SAMPLES];

void pcssInitPoissonSamples( const in vec2 randomSeed ) {
	float ANGLE_STEP = PI2 * float( PCSS_NUM_RINGS ) / float( PCSS_NUM_SAMPLES );
	float INV_NUM_SAMPLES = 1.0 / float( PCSS_NUM_SAMPLES );
	float angle = rand( randomSeed ) * PI2;
	float radius = INV_NUM_SAMPLES;
	float radiusStep = radius;
	for ( int i = 0; i < PCSS_NUM_SAMPLES; i ++ ) {
		pcssPoissonDisk[ i ] = vec2( cos( angle ), sin( angle ) ) * pow( radius, 0.75 );
		radius += radiusStep;
		angle += ANGLE_STEP;
	}
}

float pcssPenumbraSize( const in float zReceiver, const in float zBlocker ) {
	return ( zReceiver - zBlocker ) / zBlocker;
}

float pcssFindBlocker( sampler2D shadowMap, const in vec2 uv, const in float zReceiver ) {
	// Gleiche Skala wie der Filter — sonst weiche Umbra innen, harte Texel-Kante außen.
	float searchRadius = pcssLightSizeUv * PCSS_PENUMBRA_SCALE * ( zReceiver - PCSS_NEAR_PLANE ) / zReceiver;
	float blockerDepthSum = 0.0;
	int numBlockers = 0;
	for ( int i = 0; i < PCSS_BLOCKER_SEARCH_NUM_SAMPLES; i++ ) {
		float shadowMapDepth = texture2D( shadowMap, uv + pcssPoissonDisk[ i ] * searchRadius ).r;
		#ifdef USE_REVERSED_DEPTH_BUFFER
		if ( shadowMapDepth > zReceiver ) {
		#else
		if ( shadowMapDepth < zReceiver ) {
		#endif
			blockerDepthSum += shadowMapDepth;
			numBlockers ++;
		}
	}
	if ( numBlockers == 0 ) return -1.0;
	return blockerDepthSum / float( numBlockers );
}

float pcssFilter( sampler2D shadowMap, vec2 uv, float zReceiver, float filterRadius ) {
	float sum = 0.0;
	float depth;
	#pragma unroll_loop_start
	for ( int i = 0; i < ${PCSS_NUM_SAMPLES_INTERNAL}; i ++ ) {
		depth = texture2D( shadowMap, uv + pcssPoissonDisk[ i ] * filterRadius ).r;
		#ifdef USE_REVERSED_DEPTH_BUFFER
		if ( zReceiver >= depth ) sum += 1.0;
		#else
		if ( zReceiver <= depth ) sum += 1.0;
		#endif
	}
	#pragma unroll_loop_end
	#pragma unroll_loop_start
	for ( int i = 0; i < ${PCSS_NUM_SAMPLES_INTERNAL}; i ++ ) {
		depth = texture2D( shadowMap, uv + -pcssPoissonDisk[ i ].yx * filterRadius ).r;
		#ifdef USE_REVERSED_DEPTH_BUFFER
		if ( zReceiver >= depth ) sum += 1.0;
		#else
		if ( zReceiver <= depth ) sum += 1.0;
		#endif
	}
	#pragma unroll_loop_end
	return sum / ( 2.0 * float( ${PCSS_NUM_SAMPLES_INTERNAL} ) );
}

float pcssGetShadow( sampler2D shadowMap, vec4 coords ) {
	vec2 uv = coords.xy;
	float zReceiver = coords.z;
	pcssInitPoissonSamples( uv );
	float avgBlockerDepth = pcssFindBlocker( shadowMap, uv, zReceiver );
	if ( avgBlockerDepth == -1.0 ) return 1.0;
	float penumbraRatio = pcssPenumbraSize( zReceiver, avgBlockerDepth );
	float filterRadius = penumbraRatio * pcssLightSizeUv * PCSS_PENUMBRA_SCALE;
	return pcssFilter( shadowMap, uv, zReceiver, filterRadius );
}
`

const PCSS_BASIC_GET_SHADOW = `#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				shadow = pcssGetShadow( shadowMap, shadowCoord );
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif`

const BASIC_GET_SHADOW_MARKER = `#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif`

/** Hard BasicCube getPointShadow — radius wird ignoriert; wir ersetzen durch Soft-Taps. */
const BASIC_GET_POINT_SHADOW_MARKER = `float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}`

/**
 * Soft Basic getPointShadow — 17 Disk-Taps.
 * Ortho-2D vergrößert Cube-Texel stark; deshalb mind. ~3 Texel Weichheit und größerer Radius-Bereich.
 */
const BASIC_GET_POINT_SHADOW_SOFT = `float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float texelSize = max( shadowRadius, 3.0 ) / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float sum = 0.0;
			vec2 offs[17];
			offs[0] = vec2( 0.0, 0.0 );
			offs[1] = vec2( 1.0, 0.0 );
			offs[2] = vec2( -1.0, 0.0 );
			offs[3] = vec2( 0.0, 1.0 );
			offs[4] = vec2( 0.0, -1.0 );
			offs[5] = vec2( 0.7071, 0.7071 );
			offs[6] = vec2( -0.7071, 0.7071 );
			offs[7] = vec2( 0.7071, -0.7071 );
			offs[8] = vec2( -0.7071, -0.7071 );
			offs[9] = vec2( 1.5, 0.0 );
			offs[10] = vec2( -1.5, 0.0 );
			offs[11] = vec2( 0.0, 1.5 );
			offs[12] = vec2( 0.0, -1.5 );
			offs[13] = vec2( 1.0607, 1.0607 );
			offs[14] = vec2( -1.0607, 1.0607 );
			offs[15] = vec2( 1.0607, -1.0607 );
			offs[16] = vec2( -1.0607, -1.0607 );
			for ( int i = 0; i < 17; i ++ ) {
				vec3 dir = normalize( bd3D + ( tangent * offs[ i ].x + bitangent * offs[ i ].y ) * texelSize );
				float depth = textureCube( shadowMap, dir ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					depth = 1.0 - depth;
				#endif
				sum += step( dp, depth );
			}
			shadow = sum / 17.0;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}`

let originalShadowmapParsFragment: string | undefined
let pcssEnabled = false
let pcssChunkApplied = false
const pcssLightSizeUvUniform = { value: 0.002 }

/** Nutzer-Slider 0,5…8 → Lichtfläche in cm (Penumbra-Breite). */
export function pcssLightWorldSizeFromSoftness(softness: number): number {
  const t = THREE.MathUtils.clamp((softness - 0.5) / 7.5, 0, 1)
  return THREE.MathUtils.lerp(PCSS_LIGHT_WORLD_SIZE_MIN_CM, PCSS_LIGHT_WORLD_SIZE_MAX_CM, t)
}

/**
 * Punktlicht-Cube-Shadow-Radius aus dem Weichheit-Slider (BasicShadowMap nutzt das
 * sonst nicht — Soft-Taps in BASIC_GET_POINT_SHADOW_SOFT).
 * @param scale Extra-Faktor (z. B. 2 in Ortho-2D, wo Cube-Texel stark vergrößert werden).
 */
export function pointShadowRadiusFromSoftness(softness: number, scale = 1): number {
  const t = THREE.MathUtils.clamp((softness - 0.5) / 7.5, 0, 1)
  return THREE.MathUtils.lerp(3, 32, t) * Math.max(0.5, scale)
}

/** Lichtgröße in UV-Raum relativ zur Ortho-Frustum-Breite (cm). */
export function pcssLightSizeUvFromSoftness(softness: number, frustumWidthCm: number): number {
  const frustum = Math.max(1, frustumWidthCm)
  return pcssLightWorldSizeFromSoftness(softness) / frustum
}

export function getPcssLightSizeUv(): number {
  return pcssLightSizeUvUniform.value
}

function buildPcssShadowmapParsFragment(): string {
  const base = originalShadowmapParsFragment ?? THREE.ShaderChunk.shadowmap_pars_fragment
  const defines = `
uniform float pcssLightSizeUv;
#define PCSS_NEAR_PLANE ${PCSS_NEAR_PLANE.toFixed(8)}
#define PCSS_PENUMBRA_SCALE ${PCSS_PENUMBRA_SCALE.toFixed(4)}
`
  let shader = base.replace('#ifdef USE_SHADOWMAP', `#ifdef USE_SHADOWMAP${defines}${PCSS_GLSL_HELPERS}`)
  if (!shader.includes(BASIC_GET_SHADOW_MARKER)) {
    throw new Error('pcssShadows: shadowmap_pars_fragment Basic-getShadow-Marker nicht gefunden')
  }
  shader = shader.replace(BASIC_GET_SHADOW_MARKER, PCSS_BASIC_GET_SHADOW)
  if (!shader.includes(BASIC_GET_POINT_SHADOW_MARKER)) {
    throw new Error('pcssShadows: Basic-getPointShadow-Marker nicht gefunden')
  }
  shader = shader.replace(BASIC_GET_POINT_SHADOW_MARKER, BASIC_GET_POINT_SHADOW_SOFT)
  return shader
}

function applyPcssShadowmapChunk(): void {
  THREE.ShaderChunk.shadowmap_pars_fragment = buildPcssShadowmapParsFragment()
  pcssChunkApplied = true
}

function bindPcssLightSizeUniform(material: THREE.Material): boolean {
  if (material.userData.pcssLightSizeBound) return false
  material.userData.pcssLightSizeBound = true
  const prev = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    prev(shader, renderer)
    shader.uniforms.pcssLightSizeUv = pcssLightSizeUvUniform
  }
  material.needsUpdate = true
  return true
}

/** Materialien anbinden bzw. nach Chunk-Wechsel neu kompilieren. */
export function invalidateShadowMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of materials) {
      if (!mat) continue
      bindPcssLightSizeUniform(mat)
      mat.needsUpdate = true
    }
  })
}

function bindPcssUniformsOn(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of materials) {
      if (mat) bindPcssLightSizeUniform(mat)
    }
  })
}

/** PCSS aktivieren (BasicShadowMap + ShaderChunk-Override). Original-Chunk wird gesichert. */
export function enablePcssShadows(): void {
  if (originalShadowmapParsFragment === undefined) {
    originalShadowmapParsFragment = THREE.ShaderChunk.shadowmap_pars_fragment
  }
  pcssEnabled = true
  if (!pcssChunkApplied) applyPcssShadowmapChunk()
}

/** PCSS deaktivieren und den Three.js-Standard-Chunk wiederherstellen. */
export function disablePcssShadows(): void {
  if (originalShadowmapParsFragment !== undefined) {
    THREE.ShaderChunk.shadowmap_pars_fragment = originalShadowmapParsFragment
  }
  pcssEnabled = false
  pcssChunkApplied = false
}

export function isPcssShadowsEnabled(): boolean {
  return pcssEnabled
}

/**
 * PCSS-Lichtgröße aus Schattenweichheit und Ortho-Frustum aktualisieren.
 * Schreibt nur die Uniform — kein Shader-Rebuild (Slider bleibt live).
 * @param frustumWidthCm max(left/right/top/bottom)-Spanne der Shadow-Camera in cm
 */
export function updatePcssShadowParameters(
  softness: number,
  frustumWidthCm: number,
  root?: THREE.Object3D,
): void {
  if (!pcssEnabled) return
  if (!pcssChunkApplied) applyPcssShadowmapChunk()
  pcssLightSizeUvUniform.value = pcssLightSizeUvFromSoftness(softness, frustumWidthCm)
  if (root) bindPcssUniformsOn(root)
}

/** Frustum-Breite (cm) aus einer DirectionalLight-Shadow-Camera. */
export function shadowFrustumWidthCm(dirLight: THREE.DirectionalLight): number {
  const cam = dirLight.shadow.camera
  return Math.max(cam.right - cam.left, cam.top - cam.bottom, 1)
}
