import Link from "next/link";

type SearchParams = Record<string, string | string[] | undefined>;

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildHref(
  basePath: string,
  params: SearchParams,
  overrides: Record<string, string | null | undefined>,
  excludedKeys: string[] = [],
) {
  const search = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params)) {
    if (excludedKeys.includes(key)) continue;
    const value = stringParam(rawValue);
    if (value) search.set(key, value);
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value) search.set(key, value);
    else search.delete(key);
  }

  const query = search.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
}

export function CursorPaginationControls({
  basePath,
  params,
  nextCursor,
  pageSize,
}: {
  basePath: string;
  params: SearchParams;
  nextCursor: string | null;
  pageSize: number;
}) {
  const cursor = stringParam(params.cursor) || null;
  const previousCursors = (stringParam(params.prev) || "").split(",").filter(Boolean);

  if (!cursor && !nextCursor) return null;

  const previousCursor = previousCursors.at(-1) || null;
  const remainingPrevious = previousCursors.slice(0, -1);
  const nextPrevious = cursor ? [...previousCursors, cursor] : [""];

  return (
    <nav className="mt-5 flex items-center justify-between gap-4 text-[9px] uppercase tracking-[0.14em]">
      {cursor ? (
        <Link
          href={buildHref(
            basePath,
            params,
            {
              cursor: previousCursor,
              prev: remainingPrevious.length > 0 ? remainingPrevious.join(",") : null,
            },
            ["cursor", "prev", "page"],
          )}
          className="border border-[#b8b1a5] px-4 py-3 text-[#37322d] hover:border-black hover:text-black"
        >
          Previous
        </Link>
      ) : (
        <span className="border border-transparent px-4 py-3 text-[#b8b1a5]">Previous</span>
      )}

      <span className="text-[#8a847a]">{pageSize} per page</span>

      {nextCursor ? (
        <Link
          href={buildHref(
            basePath,
            params,
            {
              cursor: nextCursor,
              prev: nextPrevious.join(","),
            },
            ["cursor", "prev", "page"],
          )}
          className="border border-[#b8b1a5] px-4 py-3 text-[#37322d] hover:border-black hover:text-black"
        >
          Next
        </Link>
      ) : (
        <span className="border border-transparent px-4 py-3 text-[#b8b1a5]">Next</span>
      )}
    </nav>
  );
}

export function OffsetPaginationControls({
  basePath,
  params,
  page,
  pageSize,
  totalItems,
  totalPages,
}: {
  basePath: string;
  params: SearchParams;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-5 flex items-center justify-between gap-4 text-[9px] uppercase tracking-[0.14em]">
      {page > 1 ? (
        <Link
          href={buildHref(basePath, params, { page: String(page - 1) }, ["page", "cursor", "prev"])}
          className="border border-[#b8b1a5] px-4 py-3 text-[#37322d] hover:border-black hover:text-black"
        >
          Previous
        </Link>
      ) : (
        <span className="border border-transparent px-4 py-3 text-[#b8b1a5]">Previous</span>
      )}

      <span className="text-center text-[#8a847a]">
        Page {page} of {totalPages} | {totalItems} items | {pageSize} per page
      </span>

      {page < totalPages ? (
        <Link
          href={buildHref(basePath, params, { page: String(page + 1) }, ["page", "cursor", "prev"])}
          className="border border-[#b8b1a5] px-4 py-3 text-[#37322d] hover:border-black hover:text-black"
        >
          Next
        </Link>
      ) : (
        <span className="border border-transparent px-4 py-3 text-[#b8b1a5]">Next</span>
      )}
    </nav>
  );
}
