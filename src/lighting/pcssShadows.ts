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
 * v2.0.258: wieder 8 (v2.0.257: 10 wusch Kontakt unter Fensterbänken aus).
 */
export const PCSS_PENUMBRA_SCALE = 8

/**
 * Obergrenze der Empfänger-Tiefensteigung (Shadow-Tiefe pro Shadow-UV, ≈ tan des Winkels
 * Licht↔Fläche). Darüber (Silhouetten, Ableitung über zwei Flächen) wird gekappt,
 * sonst Lichtlecks an Kontaktkanten. Siehe `pcssReceiverPlaneSlope`.
 * v2.0.258: 6 (zuvor 12) — weniger Peter-Panning unter Sohlbank/Laibung.
 */
export const PCSS_PLANE_SLOPE_MAX = 6

/**
 * Nähe-Gewichtung der Blocker-Suche (Shadow-Tiefe 0…1; Sonnen-Frustum near 1 / far 2000 cm →
 * 0,01 ≈ 20 cm). Kleiner = nächster Caster dominiert stärker (härterer Kontakt), größer = Mittelwert.
 */
export const PCSS_BLOCKER_PROX = 0.01

/**
 * Kontakt-Blend (v2.0.260): Filterradius in Shadow-Texeln, unter dem der biasfreie Hart-Tap
 * eingemischt wird. Innerhalb dieser Spanne sind hart und weich praktisch identisch — die
 * Mischung ist unsichtbar, verhindert aber Peter-Panning durch den Slope-Bias am Kontakt.
 * Nicht vergrößern: ab wenigen Texeln entsteht wieder der „harter Kern + weicher Halo“-Look.
 */
export const PCSS_CONTACT_TEXELS_MIN = 0.5
export const PCSS_CONTACT_TEXELS_MAX = 2

/**
 * Distanz-Anti-Aliasing (v2.0.270 / v2.0.314): Deckt ein Bildschirmpixel mehrere Shadow-Texel ab
 * (Rauszoomen), wird mindestens über diese Pixel-Fläche gefiltert — Radius = Footprint × Faktor
 * (0,5 → Filterdurchmesser = ein Pixel). Nah (Footprint < Texel) bleibt der Look unverändert;
 * auf Distanz verschwinden die punktierten Stein-/Fugen-/Glas-Raster (feine 4-cm-Selbstschatten,
 * die sonst pro Pixel zufällig getroffen werden). Kein Bias-/Weichheits-Tuning.
 *
 * v2.0.314: Faktor 1,0 (Durchmesser ≈ 2 Pixel) — Rest-Speckles nach Hart-Tap-/Umbra-Early-Out-Fix.
 */
export const PCSS_FOOTPRINT_SCALE = 1.0

/** Mehr Samples = weniger sichtbares Poisson-Raster in der Penumbra (Three.js-Beispiel: 17). */
export const PCSS_NUM_SAMPLES = 32
export const PCSS_NUM_RINGS = 14

const PCSS_NUM_SAMPLES_INTERNAL = PCSS_NUM_SAMPLES
const PCSS_NUM_RINGS_INTERNAL = PCSS_NUM_RINGS

/**
 * Poisson-Disk einmal in JS berechnen (gleiche Formel wie das Three.js-Beispiel, Startwinkel 0).
 * Im Shader steht sie als `const`-Array; die Zufallsrotation pro Fragment ist eine `mat2`.
 * Vorher: globales `vec2[32]`, pro Fragment mit 32× sin/cos/pow gefüllt und dynamisch indiziert —
 * das kostete auf Metal Register/Occupancy so stark, dass ein Frame ~200 ms brauchte (v2.0.120).
 */
function buildPcssDiskGlsl(numSamples: number, numRings: number): string {
  const angleStep = (Math.PI * 2 * numRings) / numSamples
  const inv = 1 / numSamples
  let angle = 0
  let radius = inv
  const items: string[] = []
  for (let i = 0; i < numSamples; i += 1) {
    const r = Math.pow(radius, 0.75)
    items.push(`vec2( ${(Math.cos(angle) * r).toFixed(6)}, ${(Math.sin(angle) * r).toFixed(6)} )`)
    radius += inv
    angle += angleStep
  }
  return `const vec2 pcssDisk[ ${numSamples} ] = vec2[ ${numSamples} ]( ${items.join(', ')} );`
}

/** Schleifen mit Literal-Grenzen — nur so entrollt Three.js (`#pragma unroll_loop_start`). */
const PCSS_GLSL_HELPERS = `
${buildPcssDiskGlsl(PCSS_NUM_SAMPLES_INTERNAL, PCSS_NUM_RINGS_INTERNAL)}

mat2 pcssRotation( const in vec2 randomSeed ) {
	float a = rand( randomSeed ) * PI2;
	float c = cos( a );
	float s = sin( a );
	return mat2( c, s, -s, c );
}

float pcssPenumbraSize( const in float zReceiver, const in float zBlocker ) {
	return ( zReceiver - zBlocker ) / zBlocker;
}

/**
 * Receiver-Plane-Depth-Bias: Tiefensteigung der Empfängerfläche im Shadow-UV-Raum
 * (∂z/∂u, ∂z/∂v) aus Screen-Ableitungen. Jeder Tap vergleicht gegen die Ebene am Tap-Ort,
 * nicht gegen die Tiefe des Fragmentmittelpunkts — sonst Selbstabschattung (Schraffur)
 * auf horizontalen/schräg beleuchteten Flächen (Gesims-Oberseite, Sockel, Schwelle).
 */
vec2 pcssReceiverPlaneSlope( const in vec2 uv, const in float z, const in float texelUv ) {
	vec2 duvdx = dFdx( uv );
	vec2 duvdy = dFdy( uv );
	float dzdx = dFdx( z );
	float dzdy = dFdy( z );
	float det = duvdx.x * duvdy.y - duvdx.y * duvdy.x;
	if ( abs( det ) < 1e-14 ) return vec2( 0.0 );
	vec2 slope = vec2( dzdx * duvdy.y - dzdy * duvdx.y, dzdy * duvdx.x - dzdx * duvdy.x ) / det;
	// Silhouetten (Ableitung über zwei Flächen) begrenzen — sonst Lichtlecks an Kanten.
	slope = clamp( slope, vec2( -PCSS_PLANE_SLOPE_MAX ), vec2( PCSS_PLANE_SLOPE_MAX ) );
	// Distanz: deckt ein Pixel mehrere Shadow-Texel ab, laufen die Ableitungen über Stein-/Fugen-
	// und Profilkanten — die „Ebene“ ist dann Unsinn und färbt ganze Steine grau (Raster beim
	// Rauszoomen, v2.0.270). Steigung mit Texel/Footprint dämpfen: nah (Footprint ≤ Texel)
	// unverändert, fern begrenzt das den Plane-Bias am AA-Radius auf wenige Texel Tiefe.
	float footprint = max( length( duvdx ), length( duvdy ) );
	return slope * clamp( texelUv / max( footprint, 1e-8 ), 0.0, 1.0 );
}

/** Shadow-UV-Ausdehnung eines Bildschirmpixels (Distanz-AA, siehe PCSS_FOOTPRINT_SCALE). */
float pcssUvFootprint( const in vec2 uv ) {
	return max( length( dFdx( uv ) ), length( dFdy( uv ) ) );
}

/**
 * Blocker-Suche. Rückgabe: x = nähegewichtete Blocker-Tiefe (−1 ohne Blocker), y = Anzahl Blocker.
 * Gewichtung 1/(Δz + PCSS_BLOCKER_PROX): Blocker dicht am Empfänger (Sohlbank, Gesims) dominieren
 * die Penumbra-Schätzung — der ungewichtete Mittelwert zog weit entfernte Caster (Dach, Erker)
 * mit hinein und wusch Kontaktschatten aus (v2.0.257 „blass“). Physikalisch: die Kante des
 * nächsten Casters ist die schärfste, die weiteren liegen bereits im Kernschatten.
 */
vec2 pcssFindBlocker( sampler2D shadowMap, const in vec2 uv, const in float zReceiver, const in float searchRadius, const in mat2 rot, const in vec2 slope ) {
	float blockerDepthSum = 0.0;
	float weightSum = 0.0;
	float numBlockers = 0.0;
	float depth;
	float isBlocker;
	float weight;
	float zPlane;
	vec2 offset;
	#pragma unroll_loop_start
	for ( int i = 0; i < ${PCSS_NUM_SAMPLES_INTERNAL}; i ++ ) {
		offset = ( rot * pcssDisk[ i ] ) * searchRadius;
		zPlane = zReceiver + dot( slope, offset );
		depth = texture2D( shadowMap, uv + offset ).r;
		#ifdef USE_REVERSED_DEPTH_BUFFER
		isBlocker = step( zPlane, depth );
		#else
		isBlocker = 1.0 - step( zPlane, depth );
		#endif
		weight = isBlocker / ( abs( zReceiver - depth ) + PCSS_BLOCKER_PROX );
		blockerDepthSum += depth * weight;
		weightSum += weight;
		numBlockers += isBlocker;
	}
	#pragma unroll_loop_end
	if ( numBlockers < 0.5 ) return vec2( -1.0, 0.0 );
	return vec2( blockerDepthSum / weightSum, numBlockers );
}

float pcssFilter( sampler2D shadowMap, vec2 uv, float zReceiver, float filterRadius, const in mat2 rot, const in vec2 slope ) {
	float sum = 0.0;
	float depth;
	vec2 offset;
	vec2 offset2;
	#pragma unroll_loop_start
	for ( int i = 0; i < ${PCSS_NUM_SAMPLES_INTERNAL}; i ++ ) {
		offset = ( rot * pcssDisk[ i ] ) * filterRadius;
		depth = texture2D( shadowMap, uv + offset ).r;
		#ifdef USE_REVERSED_DEPTH_BUFFER
		sum += step( depth, zReceiver + dot( slope, offset ) );
		#else
		sum += step( zReceiver + dot( slope, offset ), depth );
		#endif
		offset2 = - offset.yx;
		depth = texture2D( shadowMap, uv + offset2 ).r;
		#ifdef USE_REVERSED_DEPTH_BUFFER
		sum += step( depth, zReceiver + dot( slope, offset2 ) );
		#else
		sum += step( zReceiver + dot( slope, offset2 ), depth );
		#endif
	}
	#pragma unroll_loop_end
	return sum / ( 2.0 * float( ${PCSS_NUM_SAMPLES_INTERNAL} ) );
}

/** Hart-Tap am Fragmentzentrum — Kontakt (Fensterbank, Gesims) bleibt dunkel. */
float pcssHardShadow( sampler2D shadowMap, const in vec2 uv, const in float zReceiver ) {
	float depth = texture2D( shadowMap, uv ).r;
	#ifdef USE_REVERSED_DEPTH_BUFFER
	return step( depth, zReceiver );
	#else
	return step( zReceiver, depth );
	#endif
}

/**
 * Ein Schatten, kontinuierlich: hart am Kontakt, weich mit wachsendem Caster-Abstand.
 * v2.0.258 nahm min(hard, soft) — das ergab ZWEI Schatten (harter Kern + einseitiger weicher
 * Halo), weil der Wert an der Texelkante von 0 auf ~0,5 springt. Jetzt: Hart-Tap nur dort
 * mischen, wo der PCSS-Filterradius ohnehin unter ~2 Texel liegt (dort wären hart und weich
 * identisch — der Hart-Tap ist nur frei von Slope-Bias, also lichtdicht am Kontakt).
 * Performance: Voll lit / voll Umbra brechen nach der Blocker-Suche ab (33 statt 97 Taps) —
 * nur die Penumbra zahlt den 64-Tap-Filter.
 *
 * v2.0.314 Distanz-Speckles: (1) Ohne Blocker darf der Hart-Tap auf Distanz nicht gewinnen —
 * Bias-Selbstschatten flackert unter 1 Pixel; Suche ohne Treffer ⇒ lit. (2) Umbra-Early-Out
 * nur nah — sonst färbt Distanz-AA-Suche (Nachbarsteine als „Blocker“) ganze Pixel schwarz.
 */
float pcssGetShadow( sampler2D shadowMap, vec4 coords, const in float texelUv, const in vec2 slope, const in float footprint ) {
	vec2 uv = coords.xy;
	float zReceiver = coords.z;
	float hard = pcssHardShadow( shadowMap, uv, zReceiver );
	// Distanz-AA: mindestens über die Pixel-Fläche filtern (nah: Footprint < Texel → wirkungslos).
	float aaRadius = footprint * PCSS_FOOTPRINT_SCALE;
	// Nah: Zufallsrotation bricht Poisson-Muster. Fern: feste Basis — sonst flackert jeder
	// Bildschirm-Pixel anders (fragmentierte Speckles trotz großem Filterradius, v2.0.314).
	mat2 rot = aaRadius > texelUv * 1.5
		? mat2( 1.0, 0.0, 0.0, 1.0 )
		: pcssRotation( uv );
	// Gleiche Skala wie der Filter — sonst weiche Umbra innen, harte Texel-Kante außen.
	float searchRadius = max( pcssLightSizeUv * PCSS_PENUMBRA_SCALE * ( zReceiver - PCSS_NEAR_PLANE ) / zReceiver, aaRadius );
	vec2 blocker = pcssFindBlocker( shadowMap, uv, zReceiver, searchRadius, rot, slope );
	if ( blocker.x == -1.0 ) {
		// Nah: Hart-Tap (Kontakt/Bias). Fern: Suche leer ⇒ lit, kein ungefilterter Hart-Fleck.
		float litBlend = smoothstep( texelUv * 0.25, texelUv * 2.0, aaRadius );
		return mix( hard, 1.0, litBlend );
	}
	float penumbraRatio = pcssPenumbraSize( zReceiver, blocker.x );
	float penumbraRadius = penumbraRatio * pcssLightSizeUv * PCSS_PENUMBRA_SCALE;
	float filterRadius = max( penumbraRadius, aaRadius );
	// Alle Such-Taps verdeckt und Filterscheibe innerhalb der Suchscheibe → Kernschatten, kein Filter.
	// Nur wenn die Penumbra (nicht Distanz-AA) die Radien treibt — sonst Nachbarstein-False-Umbra.
	if ( blocker.y > float( ${PCSS_NUM_SAMPLES_INTERNAL} ) - 0.5 && filterRadius <= searchRadius && aaRadius <= penumbraRadius ) return 0.0;
	float soft = pcssFilter( shadowMap, uv, zReceiver, filterRadius, rot, slope );
	float contact = 1.0 - smoothstep( PCSS_CONTACT_TEXELS_MIN * texelUv, PCSS_CONTACT_TEXELS_MAX * texelUv, filterRadius );
	return mix( soft, hard, contact );
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
			// Ableitungen vor dem Branch (uniformer Kontrollfluss für dFdx/dFdy).
			vec2 pcssSlope = pcssReceiverPlaneSlope( shadowCoord.xy, shadowCoord.z, 1.0 / shadowMapSize.x );
			float pcssFootprint = pcssUvFootprint( shadowCoord.xy );
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				// Immer volles PCSS — kein Orbit-1-Tap (wirkte als harter Schatten / Wandfarben-Flash).
				shadow = pcssGetShadow( shadowMap, shadowCoord, 1.0 / shadowMapSize.x, pcssSlope, pcssFootprint );
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
let pcssChunkApplied = false
const pcssLightSizeUvUniform = { value: 0.002 }

/** Nutzer-Slider 0,5…8 → Lichtfläche in cm (Penumbra-Breite). */
export function pcssLightWorldSizeFromSoftness(softness: number): number {
  const t = THREE.MathUtils.clamp((softness - 0.5) / 7.5, 0, 1)
  return THREE.MathUtils.lerp(PCSS_LIGHT_WORLD_SIZE_MIN_CM, PCSS_LIGHT_WORLD_SIZE_MAX_CM, t)
}

/**
 * Punktlicht `shadow.radius` aus dem Weichheit-Slider.
 * Seit v2.0.118 nutzt der Hard-Cube-Shader den Radius nicht mehr (kein Soft-Würfel).
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
#define PCSS_PLANE_SLOPE_MAX ${PCSS_PLANE_SLOPE_MAX.toFixed(4)}
#define PCSS_BLOCKER_PROX ${PCSS_BLOCKER_PROX.toFixed(6)}
#define PCSS_CONTACT_TEXELS_MIN ${PCSS_CONTACT_TEXELS_MIN.toFixed(4)}
#define PCSS_CONTACT_TEXELS_MAX ${PCSS_CONTACT_TEXELS_MAX.toFixed(4)}
#define PCSS_FOOTPRINT_SCALE ${PCSS_FOOTPRINT_SCALE.toFixed(4)}
`
  let shader = base.replace('#ifdef USE_SHADOWMAP', `#ifdef USE_SHADOWMAP${defines}${PCSS_GLSL_HELPERS}`)
  if (!shader.includes(BASIC_GET_SHADOW_MARKER)) {
    throw new Error('pcssShadows: shadowmap_pars_fragment Basic-getShadow-Marker nicht gefunden')
  }
  shader = shader.replace(BASIC_GET_SHADOW_MARKER, PCSS_BASIC_GET_SHADOW)
  // Punktlicht bleibt Hard-Cube (Three.js-Default). Soft-Taps (v2.0.111) zeichnet die
  // L∞-Far-Grenze als imaginären Würfel auf leere Flächen — entfernt in v2.0.118.
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
  const prevCacheKey =
    typeof material.customProgramCacheKey === 'function'
      ? material.customProgramCacheKey.bind(material)
      : () => ''
  material.customProgramCacheKey = () => `${prevCacheKey()}|pcss-dist-aa-314`
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
