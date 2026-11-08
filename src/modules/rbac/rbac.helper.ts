import { SELF_SERVICE_MEMBER_PATHS } from "./rbac.constants";

export function matchDynamicPath(pattern: string, actualPath: string): boolean {
  const cleanPattern = pattern.split("?")[0].replace(/\/+$/, "") || "/";
  const cleanActual = actualPath.split("?")[0].replace(/\/+$/, "") || "/";

  if (cleanPattern === cleanActual) return true;

  const patternParts = cleanPattern.split("/").filter(Boolean);
  const actualParts = cleanActual.split("/").filter(Boolean);

  if (patternParts.length !== actualParts.length) return false;

  return patternParts.every(
    (part, i) =>
      (part.startsWith("[") && part.endsWith("]")) || part === actualParts[i]
  );
}

export function isSelfServiceMemberPath(pathname: string): boolean {
  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return SELF_SERVICE_MEMBER_PATHS.has(clean);
}
