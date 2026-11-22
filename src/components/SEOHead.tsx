import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { StorageService } from '../services/storage';

export interface SEOHeadProps {
  title?: string;
  rawTitle?: boolean;
  description?: string;
  keywords?: string[];
  canonicalPath?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'product' | 'article' | 'profile';
  twitterCard?: 'summary_large_image' | 'summary';
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  noIndex?: boolean;
  schemaJsonLd?: Record<string, any> | Array<Record<string, any>>;
  productData?: {
    name: string;
    description?: string;
    image?: string;
    sku?: string;
    price?: number;
    currency?: string;
    inStock?: boolean;
    brand?: string;
    category?: string;
  };
  breadcrumbs?: Array<{ name: string; path?: string }>;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  rawTitle = false,
  description,
  keywords,
  canonicalPath,
  ogTitle,
  ogDescription,
  ogImage,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  twitterTitle,
  twitterDescription,
  twitterImage,
  noIndex = false,
  schemaJsonLd,
  productData,
  breadcrumbs,
}) => {
  const company = useMemo(() => StorageService.getCompanySettings(), []);

  // Compute base website URL
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://mbpersonaliza.com.br';
  const currentUrl = typeof window !== 'undefined' ? window.location.href : siteUrl;
  const canonicalUrl = canonicalPath ? `${siteUrl}${canonicalPath}` : currentUrl;

  // Compute Title & Description
  const siteName = company.name || 'MB Personaliza';
  const defaultTagline = company.tagline || 'Brindes Corporativos, Presentes Personalizados & Comunicação Visual';
  
  const fullTitle = useMemo(() => {
    if (!title) return `${siteName} — ${defaultTagline}`;
    if (rawTitle) return title;
    return `${title} | ${siteName}`;
  }, [title, rawTitle, siteName, defaultTagline]);

  const metaDescription = useMemo(() => {
    if (description) return description;
    return `${siteName}: Especialistas em ${defaultTagline.toLowerCase()}. Gravação a laser, serigrafia, DTF e bordado com orçamentos express online e envio para todo o Brasil.`;
  }, [description, siteName, defaultTagline]);

  // Default image (OG / Twitter)
  const defaultImage = company.logoUrl || `${siteUrl}/logo-og.png`;
  const activeOgImage = ogImage || defaultImage;

  // Default SEO Keywords
  const defaultKeywords = [
    'brindes personalizados',
    'brindes corporativos',
    'presentes personalizados',
    'gravação a laser',
    'comunicação visual',
    'copos personalizados',
    'canecas personalizadas',
    'cadernos personalizados',
    'são paulo brindes',
    'orçamento de brindes',
    'MB Personaliza',
  ];
  const activeKeywords = keywords && keywords.length > 0 ? keywords : defaultKeywords;

  // Generate Structured Data (JSON-LD)
  const structuredDataList = useMemo(() => {
    const list: Array<Record<string, any>> = [];

    // 1. Organization / Local Business Schema
    list.push({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${siteUrl}/#organization`,
      name: siteName,
      legalName: company.corporateName || siteName,
      url: siteUrl,
      logo: company.logoUrl || `${siteUrl}/logo.png`,
      image: activeOgImage,
      description: metaDescription,
      telephone: company.phone || '+55 11 98765-4321',
      email: company.email || 'contato@mbpersonaliza.com.br',
      address: {
        '@type': 'PostalAddress',
        streetAddress: `${company.address?.street || 'Rua da Mooca'}, ${company.address?.number || '1500'}`,
        addressLocality: company.address?.city || 'São Paulo',
        addressRegion: company.address?.state || 'SP',
        postalCode: company.address?.zipCode || '03104-002',
        addressCountry: 'BR',
      },
      priceRange: '$$',
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          opens: '08:00',
          closes: '18:00',
        },
      ],
      sameAs: [
        company.socialLinks?.instagram || 'https://instagram.com/mbpersonaliza',
        company.socialLinks?.whatsapp ? `https://wa.me/${company.socialLinks.whatsapp.replace(/\D/g, '')}` : undefined,
      ].filter(Boolean),
    });

    // 2. WebSite with SearchAction
    list.push({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: siteName,
      description: defaultTagline,
      inLanguage: 'pt-BR',
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
    });

    // 3. BreadcrumbList Schema (if breadcrumbs provided)
    if (breadcrumbs && breadcrumbs.length > 0) {
      list.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((crumb, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: crumb.name,
          item: crumb.path ? `${siteUrl}${crumb.path}` : currentUrl,
        })),
      });
    }

    // 4. Product Schema (if on a product page)
    if (productData) {
      const productSchema: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: productData.name,
        image: productData.image ? [productData.image] : [activeOgImage],
        description: productData.description || metaDescription,
        sku: productData.sku || 'MB-PROD',
        brand: {
          '@type': 'Brand',
          name: productData.brand || siteName,
        },
        category: productData.category,
      };
      if (typeof productData.price === 'number' && productData.price > 0) {
        productSchema.offers = {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: productData.currency || 'BRL',
          price: productData.price.toFixed(2),
          itemCondition: 'https://schema.org/NewCondition',
          availability: productData.inStock !== false
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: siteName,
          },
        };
      }
      list.push(productSchema);
    }

    // 5. Custom JSON-LD passed in props
    if (schemaJsonLd) {
      if (Array.isArray(schemaJsonLd)) {
        list.push(...schemaJsonLd);
      } else {
        list.push(schemaJsonLd);
      }
    }

    return list;
  }, [
    siteUrl,
    currentUrl,
    canonicalUrl,
    siteName,
    company,
    defaultTagline,
    metaDescription,
    activeOgImage,
    breadcrumbs,
    productData,
    schemaJsonLd,
  ]);

  return (
    <Helmet>
      {/* Basic HTML & Charset */}
      <html lang="pt-BR" />
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={activeKeywords.join(', ')} />
      <meta name="author" content={siteName} />
      <meta name="application-name" content={siteName} />
      <meta name="theme-color" content={company.primaryColor || '#111111'} />

      {/* Robots Directive */}
      <meta
        name="robots"
        content={noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}
      />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={ogTitle || fullTitle} />
      <meta property="og:description" content={ogDescription || metaDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={activeOgImage} />
      <meta property="og:image:alt" content={ogTitle || fullTitle} />
      <meta property="og:locale" content="pt_BR" />

      {/* Twitter Cards */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={twitterTitle || ogTitle || fullTitle} />
      <meta name="twitter:description" content={twitterDescription || ogDescription || metaDescription} />
      <meta name="twitter:image" content={twitterImage || activeOgImage} />

      {/* Schema.org Structured Data Injection */}
      {structuredDataList.map((schema, idx) => (
        <script key={`schema-jsonld-${idx}`} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};
