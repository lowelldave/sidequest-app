"use client";

import Image from "next/image";
import { logoUrl, useShopSettings } from "@/lib/shop";

/**
 * The shop's logo: the one uploaded in Shop setup, or the built-in SideQuest
 * logo (two files, because its lettering is recoloured for dark backgrounds).
 */
export function ShopLogo({ className = "" }: { className?: string }) {
  const shop = useShopSettings();
  if (shop.logo_path) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- uploaded logos have any size
      <img src={logoUrl(shop.logo_path)} alt={shop.name} className={`object-contain ${className}`} />
    );
  }
  return (
    <>
      <Image
        src="/logo.png"
        alt={shop.name}
        width={480}
        height={318}
        priority
        className={`dark:hidden ${className}`}
      />
      <Image
        src="/logo-dark.png"
        alt={shop.name}
        width={480}
        height={318}
        priority
        className={`hidden dark:block ${className}`}
      />
    </>
  );
}
