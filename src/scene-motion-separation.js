const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x
  && a.y < b.y + b.height && a.y + a.height > b.y;

/**
 * Select background control tiles that do not overlap the current character bounds.
 * The returned regions are viewport-space crops; they are pixel controls, not
 * semantic background segmentation. IDs remain stable across preview samples.
 */
export function buildBackgroundControlRegions({
  viewport,
  characterRegions = [],
  columns = 5,
  rows = 5,
  maxRegions = 8,
  marginRatio = 0.012,
  minAreaRatio = 0.008
} = {}) {
  const width = finite(viewport?.width, 0);
  const height = finite(viewport?.height, 0);
  if (width <= 0 || height <= 0) throw new TypeError("A positive viewport is required.");
  if (!Number.isInteger(columns) || columns < 2 || columns > 12
      || !Number.isInteger(rows) || rows < 2 || rows > 12
      || !Number.isInteger(maxRegions) || maxRegions < 1 || maxRegions > 32
      || !Number.isFinite(marginRatio) || marginRatio < 0 || marginRatio > 0.2
      || !Number.isFinite(minAreaRatio) || minAreaRatio < 0 || minAreaRatio > 1) {
    throw new RangeError("Background control grid settings are invalid.");
  }

  const marginX = width * marginRatio;
  const marginY = height * marginRatio;
  const occupied = (Array.isArray(characterRegions) ? characterRegions : [])
    .map(item => item?.bounds || item)
    .filter(region => region && [region.x, region.y, region.width, region.height].every(Number.isFinite)
      && region.width > 0 && region.height > 0)
    .map(region => ({
      x: clamp(region.x - marginX, 0, width),
      y: clamp(region.y - marginY, 0, height),
      width: clamp(region.x + region.width + marginX, 0, width)
        - clamp(region.x - marginX, 0, width),
      height: clamp(region.y + region.height + marginY, 0, height)
        - clamp(region.y - marginY, 0, height)
    }));

  const tileWidth = width / columns;
  const tileHeight = height / rows;
  const minArea = width * height * minAreaRatio;
  const candidates = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const bounds = {
        x: column * tileWidth,
        y: row * tileHeight,
        width: column === columns - 1 ? width - column * tileWidth : tileWidth,
        height: row === rows - 1 ? height - row * tileHeight : tileHeight
      };
      if (bounds.width * bounds.height < minArea || occupied.some(region => intersects(bounds, region))) continue;
      candidates.push({ id: "bg-" + row + "-" + column, bounds });
    }
  }
  // Spread controls across the available viewport instead of filling the
  // top-left first. This makes the background estimate less sensitive to
  // a single local effect or moving object.
  if (candidates.length <= maxRegions) return candidates;
  const centerX = width / 2;
  const centerY = height / 2;
  const selected = [];
  const remaining = [...candidates];
  let firstIndex = 0;
  let firstDistance = Infinity;
  for (let index = 0; index < remaining.length; index += 1) {
    const bounds = remaining[index].bounds;
    const dx = bounds.x + bounds.width / 2 - centerX;
    const dy = bounds.y + bounds.height / 2 - centerY;
    const distance = dx * dx + dy * dy;
    if (distance < firstDistance) {
      firstDistance = distance;
      firstIndex = index;
    }
  }
  selected.push(remaining.splice(firstIndex, 1)[0]);
  while (selected.length < maxRegions && remaining.length) {
    let bestIndex = 0;
    let bestDistance = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      const bounds = remaining[index].bounds;
      const x = bounds.x + bounds.width / 2;
      const y = bounds.y + bounds.height / 2;
      const nearestDistance = selected.reduce((nearest, item) => {
        const other = item.bounds;
        const dx = x - (other.x + other.width / 2);
        const dy = y - (other.y + other.height / 2);
        return Math.min(nearest, dx * dx + dy * dy);
      }, Infinity);
      if (nearestDistance > bestDistance) {
        bestDistance = nearestDistance;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected;
}

/**
 * Compare character-region activity with independent background control crops.
 * This separates localized pixel change from scene-wide change heuristically;
 * it cannot identify camera motion or prove a semantic character action.
 */
export function classifyCharacterBackgroundMotion(characterReport, backgroundReports) {
  if (!characterReport || !["likely-static", "visible-change"].includes(characterReport.status)) {
    return {
      status: "inconclusive-character-samples",
      characterStatus: characterReport?.status || "unavailable",
      backgroundChangedRegions: 0,
      backgroundSampledRegions: 0
    };
  }
  const reports = Array.isArray(backgroundReports)
    ? backgroundReports.filter(report => report && ["likely-static", "visible-change"].includes(report.status))
    : [];
  if (!reports.length) {
    return {
      status: "insufficient-background-controls",
      characterStatus: characterReport.status,
      backgroundChangedRegions: 0,
      backgroundSampledRegions: 0
    };
  }
  const changed = reports.filter(report => report.status === "visible-change").length;
  const stable = reports.length - changed;
  let status;
  if (changed === 0) {
    status = characterReport.status === "visible-change"
      ? "character-localized-change"
      : "little-visible-change";
  } else if (changed > reports.length / 2) {
    status = characterReport.status === "visible-change"
      ? "scene-wide-or-mixed-change"
      : "background-or-camera-change";
  } else {
    status = "inconclusive-mixed-background";
  }
  return {
    status,
    characterStatus: characterReport.status,
    backgroundChangedRegions: changed,
    backgroundStableRegions: stable,
    backgroundSampledRegions: reports.length,
    limitation: "Pixel differences in control crops can come from camera movement, animated scenery, lighting, particles, cuts, or unrelated objects; this is not camera tracking or semantic action recognition."
  };
}
