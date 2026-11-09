"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Ảnh tải lười: khung kem có vệt sáng lướt (mẫu A1) tới khi ảnh về, rồi hiện dần. Ảnh đã có sẵn trong bộ nhớ đệm hiện ngay.
export function FadeImage({ src, alt, sizes }: { src: string; alt: string; sizes: string }) {
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setReady(true);
  }, []);
  return (
    <>
      {!ready && <span className="img-shimmer absolute inset-0" aria-hidden />}
      <Image ref={ref} src={src} alt={alt} fill sizes={sizes} loading="lazy" onLoad={() => setReady(true)} onError={() => setReady(true)} className={`product-art object-cover transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} />
    </>
  );
}
