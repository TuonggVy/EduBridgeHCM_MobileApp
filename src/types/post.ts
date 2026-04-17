export type PostCategory =
  | 'CAMPUS_ADMISSION'
  | 'CAMPUS_EVENTS'
  | 'CAMPUS_SCHOLARSHIP'
  | string;

export type PostImageItem = {
  url: string;
  position: number;
};

export type PostImageJson = {
  imageItemList: PostImageItem[];
};

export type PostAuthor = {
  name: string;
};

export type PostContentData = {
  text: string;
  position: number;
};

export type PostContent = {
  type: string;
  contentDataList: PostContentData[];
  shortDescription: string;
};

export type SchoolPost = {
  id: number;
  imageJson: PostImageJson | null;
  thumbnail: string | null;
  author: PostAuthor | null;
  categoryPost: PostCategory;
  totalPosition: number | null;
  publishedDate: string | null;
  content: PostContent | null;
  hashTag: string[];
  typeFile: string | null;
  status: string | null;
};

export type PostListResponse = {
  message: string;
  body: SchoolPost[];
};
