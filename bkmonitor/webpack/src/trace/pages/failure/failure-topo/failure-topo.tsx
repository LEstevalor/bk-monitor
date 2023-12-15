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
import { defineComponent, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { Arrow, Graph, registerEdge, registerLayout, registerNode, Tooltip } from '@antv/g6';
import { incidentTopology } from '@api/modules/incident';
import { addListener, removeListener } from 'resize-detector';
import { debounce } from 'throttle-debounce';

import ResourceGraph from '../resource-graph/resource-graph';
import { useIncidentInject } from '../utils';

import dbsvg from './db.svg';
import FailureTopoTooltips from './failure-topo-tooltips';
import httpSvg from './http.svg';
import TopoTools from './topo-tools';
import { ITopoCombo, ITopoData, ITopoNode } from './types';
import { getNodeAttrs } from './utils';

import './failure-topo.scss';

export default defineComponent({
  name: 'FailureTopo',
  setup() {
    const topoGraphRef = ref<HTMLDivElement>(null);
    const graphRef = ref<HTMLDivElement>(null);
    let graph: Graph;
    let tooltips = null;
    const tooltipsModel = shallowRef<ITopoNode | ITopoNode[]>();
    const tooltipsType = ref('node');
    const tooltipsRef = ref<InstanceType<typeof FailureTopoTooltips>>();
    let topoRawData: ITopoData = null;
    const autoAggregate = ref(true);
    const aggregateConfig = ref({});
    const incidentId = useIncidentInject();
    const nodeEntityId = ref('');
    const registerCustomNode = () => {
      registerNode('topo-node', {
        afterDraw(cfg, group) {
          const nodeAttrs = getNodeAttrs(cfg as ITopoNode);
          if ((cfg as ITopoNode).entity.is_root) {
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
                ...nodeAttrs.rectAttrs
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
                ...nodeAttrs.textAttrs
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
          const { entity } = cfg as ITopoNode;
          const nodeAttrs = getNodeAttrs(cfg as ITopoNode);
          const nodeShape = group.addShape('circle', {
            zIndex: 10,
            attrs: {
              lineWidth: 1, // 描边宽度
              cursor: 'pointer', // 手势类型
              r: 20, // 圆半径
              ...nodeAttrs.groupAttrs
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
              img: entity.is_anomaly ? dbsvg : httpSvg // 图片资源
            },
            name: 'topo-node-img'
          });
          if (entity.aggregated_entites?.length) {
            group.addShape('rect', {
              zIndex: 10,
              attrs: {
                x: -15,
                y: 12,
                width: 30,
                height: 16,
                radius: 8,
                fill: '#fff',
                ...nodeAttrs.rectAttrs
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
                text: entity.is_root ? '根因' : entity.aggregated_entites.length,
                fontSize: 12,
                fill: '#fff',
                ...nodeAttrs.textAttrs
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
          const instanceCombos = combos.filter((item: ITopoCombo) => item.dataType === 'service_instance');
          let xCount = 0;
          const yBegin = nodeSize / 2;
          const xBegin = nodeSize / 2;
          const padding = 16 * 2;
          let totalWidth = 0;
          instanceCombos.forEach(combo => {
            const comboNodes = nodes.filter(node => node.comboId.toString() === combo.id.toString());
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
        },
        execute() {
          const { nodes, combos } = this;
          const width = graph.getWidth();
          const nodeSize = 46;
          const comboLableHeight = 40;
          const begin = nodeSize / 2 + comboLableHeight;
          let totalWidth = 0;
          let totalHeight = 0;
          const nodeMargin = 40;
          const maxColumnCount = 2;
          const minComboHeight = 66 * maxColumnCount;
          let hasNoSpecial = false;
          console.info('minComboHeight', minComboHeight);
          debugger;
          combos.forEach(combo => {
            const comboNodes = nodes.filter(node => node.comboId.toString() === combo.id.toString());
            const comboWidth = comboNodes.length * (nodeSize + nodeMargin) + 6;
            const needNewRow = totalWidth !== 0 && totalWidth + comboWidth > width;
            let xBegin = needNewRow ? 0 : totalWidth;
            let yBegin = needNewRow ? totalHeight + minComboHeight : totalHeight;
            let nodeStep = nodeMargin + nodeSize;
            let yStep = nodeMargin;
            const isSpecial = ['host_platform', 'data_center'].includes(combo.dataType);
            if (isSpecial) {
              yBegin = totalHeight + (hasNoSpecial ? minComboHeight : 0);
              xBegin = 0;
              nodeStep = width / comboNodes.length;
              yStep = nodeMargin;
            } else {
              hasNoSpecial = true;
            }
            comboNodes.forEach((node, index) => {
              node.x = xBegin + index * nodeStep + begin;
              node.y = yBegin + (index % maxColumnCount) * yStep + begin;
            });
            totalWidth = needNewRow ? comboWidth : totalWidth + comboWidth;
            totalHeight = yBegin;
            hasNoSpecial = true;
          });
        }
      });
    };
    const registerCustomTooltip = () => {
      tooltips = new Tooltip({
        offsetX: 10,
        offsetY: 10,
        trigger: 'click',
        itemTypes: ['edge', 'node'],
        getContent: e => {
          const type = e.item.getType();
          const model = e.item.getModel();
          if (type === 'edge') {
            const targetModel = topoRawData.nodes.find(item => item.id === model.target);
            const sourceModel = topoRawData.nodes.find(item => item.id === model.source);
            tooltipsModel.value = [targetModel, sourceModel];
          } else {
            tooltipsModel.value = model as ITopoNode;
            nodeEntityId.value = tooltipsModel.value.entity.entity_id;
          }
          tooltipsType.value = type;
          return tooltipsRef.value.$el;
        }
      });
    };
    const handleResize = () => {
      if (!graph || graph.get('destroyed') || !graphRef.value) return;
      const { width, height } = graphRef.value.getBoundingClientRect();
      graph.changeSize(width, Math.max(160 * topoRawData.combos.length, height));
      graph.render();
    };
    const onResize = debounce(300, handleResize);
    const getGraphData = async () => {
      topoRawData = await incidentTopology({
        id: incidentId.value,
        auto_aggregate: autoAggregate.value,
        aggregate_config: aggregateConfig.value
      }).then(({ combos = [], edges = [], nodes = [] }) => {
        nodeEntityId.value = nodes[0]?.entity.entity_id;
        return {
          combos: combos.map(combo => ({ ...combo, id: combo.id.toString() })),
          edges,
          nodes: nodes.map(node => ({ ...node, id: node.id.toString(), comboId: node.comboId.toString() }))
        };
      });
    };
    const renderGraph = () => {
      graph.data(JSON.parse(JSON.stringify(topoRawData)));
      graph.render();
    };
    onMounted(async () => {
      await getGraphData();
      const { width, height } = graphRef.value.getBoundingClientRect();
      console.info('topo graph', width, height);
      registerCustomNode();
      registerCustomEdge();
      registerCustomLayout();
      registerCustomTooltip();
      graph = new Graph({
        container: graphRef.value,
        width,
        height: Math.max(160 * topoRawData.combos.length, height),
        fitViewPadding: 0,
        fitCenter: false,
        fitView: false,
        minZoom: 0.00000001,
        groupByTypes: false,
        plugins: [tooltips],
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
          // padding: [10, 10],
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
        const isInvoke = cfg.type === 'invoke';
        const edg = {
          ...cfg,
          style: {
            endArrow: isInvoke
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
      renderGraph();
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
        const { entity } = nodeItem.getModel() as ITopoNode;
        if (entity.is_root) {
          graph.setItemState(nodeItem, 'running', true);
          return;
        }
      });
      graph.on('combo:click', () => {
        tooltips.hide();
      });
      graph.on('afterlayout', () => {
        const combos = graph.getCombos();
        const instanceCombos = combos.filter(combo => combo.get('model').dataType === 'service_instance');
        let i = 0;
        let w = 0;
        let minX = 0;
        let maxX = 0;
        while (i < instanceCombos.length) {
          const combo = instanceCombos[i];
          const bbox = combo.getBBox();
          let totalWidth = 0;
          const sameRowCombo = instanceCombos.filter(c => {
            const model = c.getBBox();
            if (model.y === bbox.y) {
              totalWidth += model.width;
              return true;
            }
            minX = !minX ? model.minX : Math.min(minX, model.minX);
            maxX = !maxX ? model.maxX : Math.max(maxX, model.maxX);
            return false;
          });
          w = Math.max(maxX, graph.getWidth());
          let totalDiffX = 0;
          //
          sameRowCombo.forEach(instanceCombo => {
            const { width } = instanceCombo.getBBox();
            const realWidth = Math.min(w - 80, (width / totalWidth) * w - 22 * 3 + (sameRowCombo.length - 1) * 2);
            graph.updateItem(instanceCombo, {
              fixSize: [realWidth, 80],
              x: realWidth / 2 + totalDiffX + Math.max(minX, 20) * 2
            });
            totalDiffX += realWidth + 52;
          });
          i += Math.max(sameRowCombo.length, 1);
        }
        combos.forEach(combo => {
          if (['data_center', 'host_platform'].includes(combo.get('model').dataType)) {
            const comboW = Math.max(maxX, graph.getWidth());
            graph.updateItem(combo, {
              fixSize: [comboW - 80, 80],
              x: comboW / 2
            });
            return;
          }
        });
      });
      addListener(topoGraphRef.value, onResize);
    });
    onUnmounted(() => {
      topoGraphRef.value && removeListener(topoGraphRef.value, onResize);
    });
    const handleUpdateAggregateConfig = async config => {
      aggregateConfig.value = config.aggregate_config;
      autoAggregate.value = config.auto_aggregate;
      await getGraphData();
      renderGraph();
    };
    return {
      topoGraphRef,
      graphRef,
      tooltipsRef,
      tooltipsModel,
      tooltipsType,
      handleUpdateAggregateConfig
    };
  },
  render() {
    return (
      <div class='failure-topo'>
        <TopoTools onUpdate:AggregationConfig={this.handleUpdateAggregateConfig} />
        <div
          class='topo-graph-wrapper'
          ref='topoGraphRef'
        >
          <div
            ref='graphRef'
            class='topo-graph'
            id='topo-graph'
          />
          <ResourceGraph entityId={''} />
        </div>
        <div style='display: none'>
          <FailureTopoTooltips
            ref='tooltipsRef'
            model={this.tooltipsModel}
            type={this.tooltipsType}
          />
        </div>
      </div>
    );
  }
});
