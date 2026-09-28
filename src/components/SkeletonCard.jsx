import React from 'react';

const SkeletonCard = () => (
  <div className="product-card skeleton">
    <div className="skeleton-img" />
    <div className="skeleton-line skeleton-line--title" />
    <div className="skeleton-line skeleton-line--subtitle" />
    <div className="skeleton-line skeleton-line--btn" />
  </div>
);

export default SkeletonCard;
