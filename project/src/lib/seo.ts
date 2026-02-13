export function updateMetaTags(options: {
  title?: string;
  description?: string;
  robots?: 'index, follow' | 'noindex, nofollow';
}) {
  if (options.title) {
    document.title = options.title;
  }

  if (options.description) {
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.setAttribute('name', 'description');
      document.head.appendChild(descMeta);
    }
    descMeta.setAttribute('content', options.description);
  }

  if (options.robots) {
    let robotsMeta = document.querySelector('meta[name="robots"]');
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.setAttribute('name', 'robots');
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.setAttribute('content', options.robots);
  }
}

export function setWishSEO(wish: {
  title: string;
  description?: string;
  visibility: string;
}) {
  const isPublic = wish.visibility === 'public';

  updateMetaTags({
    title: `${wish.title} - WishApp`,
    description: wish.description || wish.title,
    robots: isPublic ? 'index, follow' : 'noindex, nofollow',
  });
}

export function resetDefaultSEO() {
  updateMetaTags({
    title: 'WishApp: AI-Validated Token Wish Fulfillment',
    robots: 'noindex, nofollow',
  });
}
