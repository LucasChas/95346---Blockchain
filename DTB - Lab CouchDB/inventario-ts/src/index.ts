import { type Contract } from 'fabric-contract-api';
import { InventarioContract } from './inventario';

export const contracts: typeof Contract[] = [InventarioContract];
