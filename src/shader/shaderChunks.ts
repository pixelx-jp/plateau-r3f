import { PLATEAU_FEATURE_ID_ATTRIBUTE } from './featureId';

export const VERTEX_HEADER = `
attribute float ${PLATEAU_FEATURE_ID_ATTRIBUTE};
varying float vPlateauFeatureId;
`;

export const VERTEX_BODY = `
vPlateauFeatureId = ${PLATEAU_FEATURE_ID_ATTRIBUTE};
`;

export const FRAGMENT_HEADER = `
varying float vPlateauFeatureId;
uniform sampler2D uPlateauColorTex;
uniform vec2 uPlateauColorTexSize;
uniform float uPlateauOpacity;

vec4 plateauLookupColor(float fidIn) {
  float fid = floor(fidIn + 0.5);
  float w = uPlateauColorTexSize.x;
  float x = mod(fid, w);
  float y = floor(fid / w);
  vec2 uv = (vec2(x, y) + 0.5) / uPlateauColorTexSize;
  return texture2D(uPlateauColorTex, uv);
}
`;

export const FRAGMENT_BODY = `
vec4 plateauStyle = plateauLookupColor(vPlateauFeatureId);
diffuseColor.rgb = mix(diffuseColor.rgb, plateauStyle.rgb, plateauStyle.a);
diffuseColor.a *= uPlateauOpacity;
`;
