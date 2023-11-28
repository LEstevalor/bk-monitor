/* eslint-disable no-loop-func */
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
import { defineComponent, onMounted, onUnmounted, ref } from 'vue';
import { Arrow, Graph, registerCombo, registerEdge, registerLayout, registerNode } from '@antv/g6';
import { addListener, removeListener } from 'resize-detector';
import { debounce } from 'throttle-debounce';

import ResourceGraph from '../resource-graph/resource-graph';

import dbsvg from './db.svg';
import httpSvg from './http.svg';
import topoData, { ComboStatus, EdgeStatus, NodeStatus } from './topo-data';
import TopoTools from './topo-tools';

import './failure-topo.scss';

const StatusNodeMap = {
  [NodeStatus.Normal]: {
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
  },
  [NodeStatus.Error]: {
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
  },
  [NodeStatus.Root]: {
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
  }
};
export default defineComponent({
  name: 'FailureTopo',
  props: {
    content: {
      type: String,
      default: ''
    }
  },
  setup() {
    const topoGraphRef = ref<HTMLDivElement>(null);
    const graphRef = ref<HTMLDivElement>(null);
    let graph: Graph;
    const registerCustomNode = () => {
      registerNode('topo-node', {
        afterDraw(cfg, group) {
          if (cfg.status === NodeStatus.Root) {
            group.addShape('circle', {
              zIndex: -11,
              attrs: {
                lineWidth: 2, // 描边宽度
                cursor: 'pointer', // 手势类型
                r: 22, // 圆半径
                stroke: 'rgba(58, 59, 61, 1)'
              },
              name: 'topo-node-running'
            });
            const circle2 = group.addShape('circle', {
              attrs: {
                lineWidth: 0, // 描边宽度
                cursor: 'pointer', // 手势类型
                r: 22, // 圆半径
                stroke: 'rgba(5, 122, 234, 1)'
              },
              name: 'topo-node-running'
            });
            group.addShape('rect', {
              zIndex: 10,
              attrs: {
                x: -15,
                y: 12,
                width: 30,
                height: 16,
                radius: 8,
                fill: '#fff',
                ...StatusNodeMap[NodeStatus.Root]?.rectAttrs
              },
              name: 'topo-node-rect'
            });
            group.addShape('text', {
              zIndex: 11,
              attrs: {
                x: 0,
                y: 20,
                textAlign: 'center',
                textBaseline: 'middle',
                text: '根因',
                fontSize: 12,
                fill: '#fff',
                ...StatusNodeMap[NodeStatus.Root].textAttrs
              },
              name: 'topo-node-text'
            });
            circle2.animate(
              {
                lineWidth: 6,
                r: 24,
                strokeOpacity: 0.3
              },
              {
                repeat: true, // 循环
                duration: 3000,
                // easing: 'easeCubic',
                delay: 100 // 无延迟
              }
            );
          }
        },
        draw(cfg, group) {
          const { status, aggregateNode } = cfg as any;
          const nodeShape = group.addShape('circle', {
            zIndex: 10,
            attrs: {
              lineWidth: 1, // 描边宽度
              cursor: 'pointer', // 手势类型
              r: 20, // 圆半径
              ...StatusNodeMap[status].groupAttrs
            },
            name: 'topo-node-shape'
          });
          group.addShape('image', {
            attrs: {
              x: -12,
              y: -12,
              width: 24,
              height: 24,
              cursor: 'pointer', // 手势类型
              img: status === NodeStatus.Error ? dbsvg : httpSvg // 图片资源
            },
            name: 'topo-node-img'
          });
          if (aggregateNode?.length) {
            group.addShape('rect', {
              zIndex: 10,
              attrs: {
                x: -15,
                y: 12,
                width: 30,
                height: 16,
                radius: 8,
                fill: '#fff',
                ...StatusNodeMap[status]?.rectAttrs
              },
              name: 'topo-node-rect'
            });
            group.addShape('text', {
              zIndex: 11,
              attrs: {
                x: 0,
                y: 20,
                textAlign: 'center',
                textBaseline: 'middle',
                text: status === NodeStatus.Root ? '根因' : aggregateNode.length,
                fontSize: 12,
                fill: '#fff',
                ...StatusNodeMap[status].textAttrs
              },
              name: 'topo-node-text'
            });
          }
          return nodeShape;
        },
        setState(name, value, item) {
          const group = item.getContainer();
          const shape = group.get('children')[0]; // 顺序根据 draw 时确定
          if (name === 'hover') {
            // box-shadow: 0 2px 6px 0 rgba(0, 0, 0, 0.5);
            shape?.attr({
              shadowColor: value ? 'rgba(0, 0, 0, 0.5)' : false,
              shadowBlur: value ? 6 : false,
              shadowOffsetX: value ? 0 : false,
              shadowOffsetY: value ? 2 : false,
              strokeOpacity: value ? 0.6 : 1,
              cursor: 'pointer' // 手势类型
            });
          }
        }
      });
    };
    const registerCustomEdge = () => {
      registerEdge(
        'topo-edge',
        {
          afterDraw(cfg, group) {
            if (!cfg.count) return;
            // 获取图形组中的第一个图形，在这里就是边的路径图形
            const shape = group.get('children')[0];
            // 获取路径图形的中点坐标
            const midPoint = shape.getPoint(0.5);
            // 在中点增加一个矩形，注意矩形的原点在其左上角
            group.addShape('rect', {
              zIndex: 10,
              attrs: {
                width: 10,
                height: 10,
                fill: 'rgba(58, 59, 61, 1)',
                // x 和 y 分别减去 width / 2 与 height / 2，使矩形中心在 midPoint 上
                x: midPoint.x - 5,
                y: midPoint.y - 5,
                radius: 5
              }
            });
            group.addShape('text', {
              zIndex: 11,
              attrs: {
                x: midPoint.x,
                y: midPoint.y,
                textAlign: 'center',
                textBaseline: 'middle',
                text: cfg.count,
                fontSize: 12,
                fill: '#fff'
              },
              name: 'topo-node-text'
            });
          },
          update: undefined
        },
        'line'
      );
    };
    const registerCustomLayout = () => {
      registerLayout('topo-layout', {
        executeX() {
          // console.info('execute', this);
          const { nodes, combos } = this;
          const width = graph.getWidth();
          const nodeSize = 52;
          // const comboLableHeight = 40;
          // const begin = nodeSize / 2 + comboLableHeight;
          // const indexStep = Math.ceil(width / 500);
          const nodeMargin = 30;
          // const comboStatusValues = Object.values(ComboStatus);
          const instanceCombos = combos.filter(item => item.status === ComboStatus.Instance);
          let xCount = 0;
          const yBegin = nodeSize / 2;
          const xBegin = nodeSize / 2;
          const padding = 16 * 2;
          let totalWidth = 0;
          instanceCombos.forEach(combo => {
            const comboNodes = nodes.filter(node => node.comboId === combo.id);
            const comboWidth = xBegin + comboNodes.length * (nodeSize + nodeMargin) + padding;
            totalWidth += comboWidth;
            if (totalWidth <= width) {
              comboNodes.forEach((node, index) => {
                node.x = xBegin + index * (nodeSize + nodeMargin);
                node.y = yBegin + (xCount % 3) * (nodeSize + nodeMargin);
                xCount += 1;
              });
              return;
            }
            xCount = 0;
          });
          debugger;
        },
        execute() {
          // console.info('execute', this);
          const { nodes, edges, combos } = this;
          const width = graph.getWidth();
          const nodeSize = 46;
          const comboLableHeight = 40;
          const begin = nodeSize / 2 + comboLableHeight;
          const indexStep = Math.ceil(width / 500);
          const nodeMargin = 40;
          const comboStatusValues = Object.values(ComboStatus);
          combos.sort((a, b) => {
            const aStatus = comboStatusValues.indexOf(a.status);
            const bStatus = comboStatusValues.indexOf(b.status);
            return aStatus - bStatus;
          });
          let preBegin = 0;
          combos.forEach((combo, comboIndex) => {
            const comboNodes = nodes.filter(node => node.comboId === combo.id);
            let xBegin = (comboIndex % indexStep) * 400;
            let yBegin = Math.floor(comboIndex / indexStep) * 200;
            let nodeStep = nodeMargin + nodeSize;
            let yStep = nodeMargin;
            const isSpecial = [ComboStatus.Host, ComboStatus.DataCenter].includes(combo.status);
            if (isSpecial) {
              if (xBegin > 0) {
                yBegin = Math.floor(comboIndex / indexStep + 1) * 200;
                yBegin = preBegin === yBegin ? yBegin + 200 : yBegin;
                preBegin = yBegin;
              }
              xBegin = 0;
              nodeStep = width / comboNodes.length;
              yStep = nodeMargin * 1.2;
            }
            comboNodes.forEach((node, index) => {
              node.x = xBegin + index * nodeStep + begin;
              node.y = yBegin + (index % (isSpecial ? comboNodes.length : 3)) * yStep + begin;
            });
          });
        }
      });
    };
    const handleResize = () => {
      if (!graph || graph.get('destroyed')) return;
      const { width, height } = graphRef.value.getBoundingClientRect();
      graph.changeSize(width, Math.max(160 * topoData.combos.length, height));
      graph.render();
    };
    const onResize = debounce(300, handleResize);
    onMounted(() => {
      const { width, height } = graphRef.value.getBoundingClientRect();
      console.info('topo graph', width, height);
      registerCustomNode();
      registerCustomEdge();
      registerCustomLayout();
      graph = new Graph({
        container: graphRef.value,
        width,
        height: Math.max(160 * topoData.combos.length, height),
        fitViewPadding: 0,
        fitCenter: false,
        fitView: false,
        minZoom: 0.00000001,
        groupByTypes: false,
        layout: {
          // type: 'comboForce',
          // maxIteration: 1000,
          // nodeSpacing: () => 3,
          // // preventOverlap: true,
          // // collideStrength: 1,
          // comboSpacing: () => 100,
          // preventComboOverlap: true,
          // preventNodeOverlap: true,

          // // center: [ 0, 0 ],     // 可选，默认为图的中心
          // // linkDistance: 1050,         // 可选，边长
          // // nodeStrength: 30,         // 可选
          // edgeStrength: 0.1,        // 可选

          // // gravity: 0.1,
          // // comboGravity: 0.1,
          // // workerEnabled: true,
          // gpuEnabled: true,
          // type: 'grid',

          // type: 'dagre',
          type: 'topo-layout'
          // rankdir: 'LR',
          // align: 'UL',
          // nodesep: 10,
          // ranksep: 10,
          // sortByCombo: true
        },
        defaultNode: {
          type: 'circle',
          size: 40
        },
        defaultEdge: {
          size: 1,
          color: '#63656D'
        },
        defaultCombo: {
          type: 'rect',
          // padding: [8, 12],
          style: {
            fill: '#3A3B3D',
            radius: 6,
            stroke: '#3A3B3D'
          },
          labelCfg: {
            style: {
              fill: '#979BA5',
              fontSize: 12
            }
          }
        },
        modes: {
          default: ['drag-combo', 'drag-node', 'drag-canvas', 'zoom-canvas']
        }
      });
      graph.node(node => {
        return {
          ...node,
          type: 'topo-node'
        };
      });
      graph.edge((cfg: any) => {
        const isInvoke = cfg.type === EdgeStatus.Invoke;
        const edg = {
          ...cfg,
          style: {
            endArrow:
              cfg.type === EdgeStatus.Invoke
                ? {
                    path: Arrow.triangle(),
                    d: 0,
                    fill: '#F55555',
                    stroke: '#F55555',
                    lineDash: [0, 0]
                  }
                : false,
            fill: isInvoke ? '#F55555' : '#63656E',
            stroke: isInvoke ? '#F55555' : '#63656E',
            lineWidth: isInvoke ? 2 : 1,
            lineDash: isInvoke ? [4, 2] : false
          }
        };
        if (!cfg.color) return edg;
        return {
          ...edg,
          type: 'topo-edge'
        };
      });
      graph.data(topoData);
      graph.render();
      graph.on('node:mouseenter', e => {
        const nodeItem = e.item;
        graph.setItemState(nodeItem, 'hover', true);
      });
      // 监听鼠标离开节点
      graph.on('node:mouseleave', e => {
        const nodeItem = e.item;
        graph.setItemState(nodeItem, 'hover', false);
        graph.setItemState(nodeItem, 'running', false);
      });
      graph.on('node:click', e => {
        const nodeItem = e.item;
        const { status, aggregateNode } = nodeItem.getModel() as any;
        if (status === NodeStatus.Root) {
          graph.setItemState(nodeItem, 'running', true);
          return;
        }
      });
      graph.on('afterlayout', () => {
        // const combos = graph.getCombos();
        // const instanceCombos = combos.filter(combo => combo.get('model').status === ComboStatus.Instance);
        // let i = 0;
        // while (i < instanceCombos.length) {
        //   const combo = instanceCombos[i];
        //   const { y } = combo.getModel();
        //   const height = graph.getHeight();
        //   const bbox = combo.getBBox();
        //   const comboxHeight = height / combos.length;
        //   const h = bbox.maxY - bbox.minY;
        //   const sameRowCombo = instanceCombos.filter(combo => combo.getModel().y === y);
        //   const w = graph.getWidth();
        //   const totalWidth = instanceCombos.reduce((total, combo) => {
        //     return total + combo.getBBox().width;
        //   }, 0);
        //   let totalX = 0;
        //   sameRowCombo.forEach((instanceCombo, index) => {
        //     const { width } = instanceCombo.getBBox();
        //     const realWidth = (+width / totalWidth) * w;
        //     graph.updateItem(instanceCombo, {
        //       size: [realWidth, h],
        //       x: totalX + 20
        //     });
        //     totalX += realWidth + 12;
        //   });
        //   debugger;
        //   i += instanceCombos.length;
        // }
        // combos.forEach(combo => {
        //   // 获取 Combo 中包含的节点和边的范围
        //   const bbox = combo.getBBox();
        //   const height = graph.getHeight();
        //   const comboxHeight = height / combos.length;
        //   const h = bbox.maxY - bbox.minY;
        //   const w = graph.getWidth();
        //   if (combo.get('model').status === ComboStatus.Instance) {
        //     graph.updateItem(combo, {
        //       size: [w, h],
        //       x: w / 2
        //     });
        //     return;
        //   }
        // });
      });
      addListener(topoGraphRef.value, onResize);
    });
    onUnmounted(() => {
      removeListener(topoGraphRef.value, onResize);
    });
    return {
      topoGraphRef,
      graphRef
    };
  },
  render() {
    return (
      <div class='failure-topo'>
        <TopoTools />
        <div
          class='topo-graph-wrapper'
          ref='topoGraphRef'
        >
          <div
            ref='graphRef'
            class='topo-graph'
            id='topo-graph'
          />
          <ResourceGraph />
        </div>
      </div>
    );
  }
});
