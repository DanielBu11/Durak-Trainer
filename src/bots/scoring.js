export function evaluation(action) {
  const reasons = [];
  return {
    add(factor, points, detail) {if (points !== 0) reasons.push({factor, points, detail});},
    result() {return {action, score: reasons.reduce((sum, r) => sum + r.points, 0), reasons};},
  };
}
