"use client";

import type { Category } from "@/lib/engine/taxonomy";

/**
 * The tap-target grid for committing to a category guess. Shared by the
 * reactive solve flow's guess step and the daily practice loop, which renders
 * this same selector inline before calling the reveal engine — one component,
 * one taxonomy, both loops.
 */
export function CategorySelector({
  taxonomy,
  selected,
  onSelect,
}: {
  taxonomy: readonly Category[];
  selected: Category | null;
  onSelect: (category: Category) => void;
}) {
  return (
    <ul>
      {taxonomy.map((category) => (
        <li key={category}>
          <button
            type="button"
            aria-pressed={selected === category}
            onClick={() => onSelect(category)}
          >
            {category}
          </button>
        </li>
      ))}
    </ul>
  );
}
