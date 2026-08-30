import { useEffect } from "react";

interface PageSEOOptions {
  title: string;
  description?: string;
}

const BRAND = "Legendary Everyday";

export const usePageSEO = ({ title, description }: PageSEOOptions) => {
  useEffect(() => {
    document.title = title.includes(BRAND) ? title : `${title} | ${BRAND}`;

    if (description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", description);
    }

    return () => {
      // Reset to default on unmount
      document.title = `${BRAND} | Premium Specialty Coffee`;
    };
  }, [title, description]);
};
