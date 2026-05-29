import type { Attribution, Manifest } from '../types/public';

export function attributionsFromManifest(m: Manifest): Attribution[] {
  const license = m.attribution ?? '© Project PLATEAU / MLIT (CC BY 4.0)';
  const generated_at = m.generated_at;
  const sources = m.sources ?? {};
  const ids = Object.keys(sources);
  if (ids.length === 0) {
    return [{ dataset_id: m.city_code ?? 'plateau', license, generated_at }];
  }
  return ids.map((id) => ({
    dataset_id: sources[id].dataset_id ?? id,
    source_url: sources[id].url,
    license,
    generated_at,
  }));
}
