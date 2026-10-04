"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// The two sharing checkboxes. Controlled (not just defaultChecked) so they keep their value when React resets the form
// after saving. "Show the address" only makes sense while sharing is on.
export function ShareSwitches({ isPublic, showAddress }: { isPublic: boolean; showAddress: boolean }) {
  const t = useTranslations("share.merchant");
  const [pub, setPub] = useState(isPublic);
  const [address, setAddress] = useState(showAddress);
  return (
    <>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="share_public" checked={pub} onChange={(e) => setPub(e.target.checked)} className="mt-1" />
        <span>
          <span className="font-medium">{t("publicLabel")}</span>
          <span className="block text-xs text-neutral-500">{t("publicHelp")}</span>
        </span>
      </label>
      <label className="ml-6 flex items-start gap-2 text-sm">
        <input type="checkbox" name="share_address" checked={address} onChange={(e) => setAddress(e.target.checked)} className="mt-1" />
        <span>
          <span className="font-medium">{t("addressLabel")}</span>
          <span className="block text-xs text-red-700">{t("addressWarn")}</span>
        </span>
      </label>
    </>
  );
}
