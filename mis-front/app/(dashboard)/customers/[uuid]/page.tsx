"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CustomerUuidRedirectPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/customers/detail#${encodeURIComponent(uuid)}`);
  }, [router, uuid]);

  return <div className="text-sm text-gray-600">Opening customer detail...</div>;
}
