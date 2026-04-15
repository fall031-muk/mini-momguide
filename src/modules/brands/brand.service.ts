import { Brand } from '../../db/models/brand.js';

type CreateBrandInput = {
  name: string;
  imgUrl?: string;
};

export async function listBrands() {
  return Brand.findAll({ order: [['name', 'ASC']] });
}

export async function createBrand(input: CreateBrandInput) {
  return Brand.create(input);
}
