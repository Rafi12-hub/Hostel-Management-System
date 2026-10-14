import React, { useState } from "react";

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackUrl?: string;
}

export const Image: React.FC<ImageProps> = ({
  src,
  alt = "RGMCET Image",
  className = "",
  fallbackUrl = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&auto=format&fit=crop&q=80",
  ...props
}) => {
  const [imgSrc, setImgSrc] = useState(src || fallbackUrl);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallbackUrl);
    }
  };

  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={handleError}
      className={`h-full w-full object-cover ${className}`}
      {...props}
    />
  );
};
