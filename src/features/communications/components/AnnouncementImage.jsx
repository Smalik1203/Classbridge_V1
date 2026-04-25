import React, { useEffect, useState } from 'react';
import { Image, Skeleton } from 'antd';
import { announcementsService } from '../services/communicationsService';

export default function AnnouncementImage({ path, height = 220, preview = true, style }) {
  const [src, setSrc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    if (!path) { setSrc(null); setLoading(false); return; }
    announcementsService.resolveImageUrl(path)
      .then((u) => { if (alive) setSrc(u); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path]);

  if (!path) return null;
  if (loading) return <Skeleton.Image active style={{ width: '100%', height }} />;
  if (!src) return null;
  return (
    <Image
      src={src}
      height={height}
      width="100%"
      style={{ objectFit: 'cover', borderRadius: 8, ...style }}
      preview={preview}
    />
  );
}
