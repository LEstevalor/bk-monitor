/*
 * Tencent is pleased to support the open source community by making
 * 蓝鲸智云PaaS平台 (BlueKing PaaS) available.
 *
 * Copyright (C) 2021 THL A29 Limited, a Tencent company.  All rights reserved.
 *
 * 蓝鲸智云PaaS平台 (BlueKing PaaS) is licensed under the MIT License.
 *
 * License for 蓝鲸智云PaaS平台 (BlueKing PaaS):
 *
 * ---------------------------------------------------
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of
 * the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
 * THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
import { type ModelConfig } from '@antv/g6';

export interface IEntity {
  aggregated_entites: IEntity[];
  anomaly_score: number;
  anomaly_type: string;
  entity_id: string;
  entity_name: string;
  entity_type: string;
  is_anomaly: boolean;
  is_root: boolean;
  rank: IRank;
}

export interface IRank {
  rank_id: number;
  rank_name: string;
  rank_alias: string;
}

export interface ITopoNode extends ModelConfig {
  aggregated_nodes: ITopoNode[];
  comboId: string;
  entity: IEntity;
  id: string;
}

export interface ITopoEdge extends ModelConfig {
  count: number;
  source: string;
  target: string;
  type: 'dependency' | 'invoke';
}

export interface ITopoCombo extends ModelConfig {
  dataType: string;
  id: number;
  label: string;
}

export interface ITopoData {
  combos: ITopoCombo[];
  edges: ITopoEdge[];
  nodes: ITopoNode[];
}
