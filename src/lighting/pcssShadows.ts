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
	float searchRadius = PCSS_LIGHT_SIZE_UV * ( zReceiver - PCSS_NEAR_PLANE ) / zReceiver;
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
	float filterRadius = penumbraRatio * PCSS_LIGHT_SIZE_UV * PCSS_NEAR_PLANE / zReceiver;
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

let originalShadowmapParsFragment: string | undefined
let pcssEnabled = false
let lastLightSizeUv = -1

/** Nutzer-Slider 0,5…8 → Lichtfläche in cm (Penumbra-Breite). */
export function pcssLightWorldSizeFromSoftness(softness: number): number {
  const t = THREE.MathUtils.clamp((softness - 0.5) / 7.5, 0, 1)
  return THREE.MathUtils.lerp(PCSS_LIGHT_WORLD_SIZE_MIN_CM, PCSS_LIGHT_WORLD_SIZE_MAX_CM, t)
}

/** Lichtgröße in UV-Raum relativ zur Ortho-Frustum-Breite (cm). */
export function pcssLightSizeUvFromSoftness(softness: number, frustumWidthCm: number): number {
  const frustum = Math.max(1, frustumWidthCm)
  return pcssLightWorldSizeFromSoftness(softness) / frustum
}

function buildPcssShadowmapParsFragment(lightSizeUv: number): string {
  const base = originalShadowmapParsFragment ?? THREE.ShaderChunk.shadowmap_pars_fragment
  const defines = `
#define PCSS_LIGHT_SIZE_UV ${lightSizeUv.toFixed(10)}
#define PCSS_NEAR_PLANE ${PCSS_NEAR_PLANE.toFixed(8)}
`
  let shader = base.replace('#ifdef USE_SHADOWMAP', `#ifdef USE_SHADOWMAP${defines}${PCSS_GLSL_HELPERS}`)
  if (!shader.includes(BASIC_GET_SHADOW_MARKER)) {
    throw new Error('pcssShadows: shadowmap_pars_fragment Basic-getShadow-Marker nicht gefunden')
  }
  shader = shader.replace(BASIC_GET_SHADOW_MARKER, PCSS_BASIC_GET_SHADOW)
  return shader
}

function applyShadowmapParsFragment(lightSizeUv: number): void {
  THREE.ShaderChunk.shadowmap_pars_fragment = buildPcssShadowmapParsFragment(lightSizeUv)
  lastLightSizeUv = lightSizeUv
}

/** Alle Shader mit Shadow-Map neu kompilieren (nach Chunk-Änderung). */
export function invalidateShadowMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const mat of materials) {
      if (mat) mat.needsUpdate = true
    }
  })
}

/** PCSS aktivieren (BasicShadowMap + ShaderChunk-Override). Original-Chunk wird gesichert. */
export function enablePcssShadows(): void {
  if (originalShadowmapParsFragment === undefined) {
    originalShadowmapParsFragment = THREE.ShaderChunk.shadowmap_pars_fragment
  }
  pcssEnabled = true
  if (lastLightSizeUv < 0) {
    applyShadowmapParsFragment(pcssLightSizeUvFromSoftness(2.5, 4000))
  } else {
    applyShadowmapParsFragment(lastLightSizeUv)
  }
}

/** PCSS deaktivieren und den Three.js-Standard-Chunk wiederherstellen. */
export function disablePcssShadows(): void {
  if (originalShadowmapParsFragment !== undefined) {
    THREE.ShaderChunk.shadowmap_pars_fragment = originalShadowmapParsFragment
  }
  pcssEnabled = false
  lastLightSizeUv = -1
}

export function isPcssShadowsEnabled(): boolean {
  return pcssEnabled
}

/**
 * PCSS-Lichtgröße aus Schattenweichheit und Ortho-Frustum aktualisieren.
 * @param frustumWidthCm max(left/right/top/bottom)-Spanne der Shadow-Camera in cm
 */
export function updatePcssShadowParameters(
  softness: number,
  frustumWidthCm: number,
  root?: THREE.Object3D,
): void {
  if (!pcssEnabled) return
  const lightSizeUv = pcssLightSizeUvFromSoftness(softness, frustumWidthCm)
  if (Math.abs(lightSizeUv - lastLightSizeUv) < 1e-8) return
  applyShadowmapParsFragment(lightSizeUv)
  if (root) invalidateShadowMaterials(root)
}

/** Frustum-Breite (cm) aus einer DirectionalLight-Shadow-Camera. */
export function shadowFrustumWidthCm(dirLight: THREE.DirectionalLight): number {
  const cam = dirLight.shadow.camera
  return Math.max(cam.right - cam.left, cam.top - cam.bottom, 1)
}
