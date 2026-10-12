"use client";

import React, { useState } from "react";
import { PixelGlyph } from "./PixelIcons";

interface ArtImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackText?: string;
  style?: React.CSSProperties;
}

/**
 * Image wrapper for generated SVG character art. If a source ever fails,
 * replace the broken-image icon with a themed fallback that keeps the layout.
 */
export default function ArtImage({
  src,
  alt,
  className = "",
  fallbackText,
  style,
}: ArtImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden bg-neutral-900 text-amber-200 font-black ${className}`}
        style={style}
        role="img"
        aria-label={alt}
        title={alt}
      >
        <PixelGlyph value={fallbackText || "☠️"} size={32} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      decoding="async"
      onError={() => setFailedSrc(src)}
    />
  );
}
