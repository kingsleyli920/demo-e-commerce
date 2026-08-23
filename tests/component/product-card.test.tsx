import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductCard } from '@/components/shop/product-card';

describe('<ProductCard />', () => {
  it('渲染标题、价格与销量，并链接到详情页', () => {
    render(
      <ProductCard
        product={{
          id: 1016,
          title: 'Apple AirPods 第二代',
          subtitle: '无线蓝牙耳机',
          brand: 'Apple',
          image: 'https://cdn.dummyjson.com/product-images/x/thumbnail.webp',
          minPrice: 84900,
          salesCount: 321,
          rating: 4.8,
          categoryId: 104,
        }}
      />,
    );
    expect(screen.getByTestId('product-card-title')).toHaveTextContent('Apple AirPods 第二代');
    expect(screen.getByTestId('product-card-price')).toHaveTextContent('¥849.00');
    expect(screen.getByTestId('product-card-sales')).toHaveTextContent('已售 321');
    expect(screen.getByTestId('product-card')).toHaveAttribute('href', '/p/1016');
  });
});
