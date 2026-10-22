"use client";

import Image from "next/image";
import { useState } from "react";

export const FALLBACK_PRODUCT_IMAGE = "/img/ca-phe-sua.jpg";

export function ProductImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const imageSrc = !failed && src ? src : FALLBACK_PRODUCT_IMAGE;
  return <Image src={imageSrc} alt={alt} width={640} height={480} unoptimized onError={() => setFailed(true)} className={className} />;
}
