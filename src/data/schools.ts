export const FILTER_OPTIONS = ['Tất cả', 'Quận 1', 'Quận 3', 'Bình Thạnh', 'Phú Nhuận'];

export type School = {
  id: string;
  name: string;
  address: string;
  imageUrl: string;
};

export const SCHOOLS: School[] = [
  {
    id: '1',
    name: 'THPT Nguyễn Thị Minh Khai',
    address: 'Quận 3, TP. Hồ Chí Minh',
    imageUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?w=400',
  },
  {
    id: '2',
    name: 'THPT Marie Curie',
    address: 'Quận 3, TP. Hồ Chí Minh',
    imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400',
  },
  {
    id: '3',
    name: 'THPT Lê Quý Đôn',
    address: 'Quận 3, TP. Hồ Chí Minh',
    imageUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=400',
  },
  {
    id: '4',
    name: 'THPT Nguyễn Thị Diệu',
    address: 'Quận 3, TP. Hồ Chí Minh',
    imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400',
  },
  {
    id: '5',
    name: 'THPT Ernst Thälmann',
    address: 'Quận 1, TP. Hồ Chí Minh',
    imageUrl: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=400',
  },
];
