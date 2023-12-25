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

import { ITopoNode } from './types';

const rootNodeAttrs = {
  groupAttrs: {
    fill: '#F55555',
    stroke: '#F55555'
  },
  rectAttrs: {
    stroke: '#3A3B3D',
    fill: '#F55555'
  },
  textAttrs: {
    fill: '#fff'
  }
};
const feedbackRootAttrs = {
  groupAttrs: {
    fill: '#FF9C01',
    stroke: '#FF9C01'
  },
  rectAttrs: {
    stroke: '#3A3B3D',
    fill: '#FF9C01'
  },
  textAttrs: {
    fill: '#fff'
  }
};
const errorNodeAttrs = {
  groupAttrs: {
    fill: 'rgba(255, 102, 102, 0.4)',
    stroke: '#F55555'
  },
  rectAttrs: {
    stroke: '#F55555',
    fill: '#313238'
  },
  textErrorAttrs: {
    fill: '#313238'
  },
  textNormalAttrs: {
    fill: '#fff'
  }
};

const normalNodeAttrs = {
  groupAttrs: {
    fill: 'rgba(197, 197, 197, 0.2)',
    stroke: '#979BA5'
  },
  rectAttrs: {
    stroke: '#EAEBF0',
    fill: '#313238'
  },
  textAttrs: {
    fill: '#fff'
  }
};
export const getNodeAttrs = (node: ITopoNode) => {
  if (node?.is_feedback_root) {
    return { ...feedbackRootAttrs };
  }
  if (node.entity?.is_root) {
    return { ...rootNodeAttrs };
  }
  if (node.entity?.is_anomaly) {
    return { ...errorNodeAttrs };
  }
  return { ...normalNodeAttrs };
};
