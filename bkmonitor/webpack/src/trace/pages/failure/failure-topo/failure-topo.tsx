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
import { defineComponent, nextTick, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { Arrow, Graph, registerEdge, registerLayout, registerNode, Tooltip, Layout, registerBehavior } from '@antv/g6';
import { incidentTopology } from '@api/modules/incident';
import { addListener, removeListener } from 'resize-detector';
import { debounce } from 'throttle-debounce';
import { Popover, Slider } from 'bkui-vue';
import ResourceGraph from '../resource-graph/resource-graph';
import { useIncidentInject } from '../utils';
import kyjs from 'klayjs';
import dbsvg from './db.svg';
import FailureTopoTooltips from './failure-topo-tooltips';
import httpSvg from './http.svg';
import TopoTools from './topo-tools';
import { ITopoCombo, ITopoData, ITopoNode } from './types';
import { getNodeAttrs } from './utils';
import elk from 'elkjs';
import './failure-topo.scss';
import { divide } from 'lodash';

const NODE_TYPE = [
  {
    text: '正常',
    status: 'normal'
  },
  {
    text: '异常',
    status: 'error'
  },
  {
    text: '根因',
    status: 'root'
  },
  {
    text: '反馈的根因',
    status: 'feedBackRoot'
  }
];

export default defineComponent({
  name: 'FailureTopo',
  setup() {
    const topoGraphRef = ref<HTMLDivElement>(null);
    const graphRef = ref<HTMLDivElement>(null);
    let graph: Graph;
    let tooltips = null;
    /** g6 默认缩放级别 数值 / 10 为真实结果值  */
    const MIN_ZOOM = 2;
    const MAX_ZOOM = 100;
    const tooltipsModel = shallowRef<ITopoNode | ITopoNode[]>();
    const tooltipsType = ref('node');
    const tooltipsRef = ref<InstanceType<typeof FailureTopoTooltips>>();
    let topoRawData: ITopoData = null;
    const autoAggregate = ref(true);
    const aggregateConfig = ref({});
    const incidentId = useIncidentInject();
    const nodeEntityId = ref('');
    const zoomValue = ref(0);
    const showResourceGraph = ref(false);
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
            if (!cfg.aggregated || !cfg.count) return;
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
    const registerCustomBehavior = () => {
      registerBehavior('custom-wheel-zoom', {
        getEvents() {
          return {
            wheel: 'onWheel'
          };
        },
        onWheel(evt) {
          // 阻止默认的滚动行为
          evt.preventDefault();
          // 获取当前的缩放比例
          const currentZoom = graph.getZoom();
          // 根据 deltaY 值确定是放大还是缩小
          const zoomFactor = evt.deltaY > 0 ? 0.9 : 1.1;
          // 计算新的缩放比例
          let newZoom = currentZoom * zoomFactor;
          // 限制缩放比例在0.2至10之间
          newZoom = Math.min(MAX_ZOOM / 10, Math.max(MIN_ZOOM / 10, newZoom));
          // 使用 graph.zoomTo 方法设置新的缩放比例
          graph.zoomTo(newZoom);
        }
      });
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
          return;
          console.log('asdasasd,', 'execute');
          const { nodes } = this;
          const width = graph.getWidth();
          const height = graph.getHeight();
          const combos = graph.getCombos();
          const filterCombos = combos.filter(item => !item.get('model').parentId);

          filterCombos.forEach((combo, index) => {
            // 获取 Combo 中包含的节点和边的范围
            const bbox = combo.getBBox();
            const prevBox = filterCombos[index - 1]?.getBBox?.();
            const height = graph.getHeight();
            const comboxHeight = height / combos.length;
            const padding = 16;
            const y = prevBox ? prevBox.height + padding : '';

            const h = bbox.maxY - bbox.minY;
            const w = graph.getWidth();
            const updateConfig = {
              // fixSize: [w, comboxHeight],
              x: -w,
              y: y
              // style: {
              //   fill: fillColor,
              //   stroke: fillColor
              // }
            };
            console.log(updateConfig, 'updateConfig');
            // const fillColor =
            //   groups.findIndex(id => id === combo.get('model').groupId) % 2 === 1 ? '#292A2B' : '#1B1C1F';
            graph.updateItem(combo, updateConfig);
            const { id, parentId } = combo.get('model');
            if (parentId) {
              console.info('parentId', parentId);
            }
            const childCombo = combos.find(item => item.get('model').parentId === id);
            if (childCombo) {
              return;
              console.log('childCombochildCombo', childCombo, combo.getBBox(), combo);
              graph.updateItem(childCombo, {
                // fixSize: [w, 108],
                x: combo.getBBox().width - 30,
                y: 108 / 2 + 16
              });
            }
          });
          return;
          console.log(combos, '...', this, nodes);
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
<<<<<<< deploy/paas3-dev-v2 8efdabea9311ca88c33c3230ec9a0c0eaad0509f
=======
          return;
>>>>>>> feat/failure_alert_frontend a6f764ba697fd0bf3a4c3199c6c9d7dee3d82501
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
    function handleResize() {
      if (!graph || graph.get('destroyed') || !graphRef.value) return;
      const { height } = document.querySelector('.failure-topo').getBoundingClientRect();
      const { width, height: cHeight } = graphRef.value.getBoundingClientRect();
      graph.changeSize(width, 1087 || Math.max(160 * topoRawData.combos.length, height - 40));
      graph.render();
    }
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
      // topoRawData.combos.forEach(combo => {
      //   combo.children = topoRawData.nodes.filter(node => node.comboId.toString() === combo.id.toString());
      // });
      // topoRawData.edges.forEach(edge => (edge.id = edge.source + '_' + edge.target));
      // new elk()
      //   .layout({
      //     // ...前面步骤中生成的ELK图形数据
      //     layoutOptions: {
      //       'elk.algorithm': 'org.eclipse.elk.layered', // 指定层次布局算法
      //       'elk.spacing.nodeNode': '50', // 节点之间的最小间距
      //       'org.eclipse.elk.edgeRouting': 'ORTHOGONAL', // 边的路由样式: 直角(ORTHOGONAL)可以帮助避免穿过节点
      //       'org.eclipse.elk.layered.unnecessaryBendpoints': 'true', // 减少不必要的边拐点
      //       'org.eclipse.elk.layered.spacing.edgeNodeBetweenLayers': '50' // 节点和边之间的层间距
      //     }
      //   })
      //   .then(graph => {})
      //   .catch(err => {
      //     console.log(err);
      //   });
    };
    const renderGraph = () => {
      graph.data(JSON.parse(JSON.stringify(topoRawData)));
      graph.render();
    };
    onMounted(async () => {
      await getGraphData();
      const { width, height } = graphRef.value.getBoundingClientRect();
      console.log(height, '....');
      console.info('topo graph', width, height);
      const maxHeight = Math.max(160 * topoRawData.combos.length, height);
      registerCustomNode();
      registerCustomBehavior();
      registerCustomEdge();
      registerCustomLayout();
      registerCustomTooltip();
      graph = new Graph({
        container: graphRef.value,
        width,
        height: maxHeight,
        fitViewPadding: 0,
        fitCenter: false,
        fitView: false,
        minZoom: 0.2,
        groupByTypes: false,
        plugins: [tooltips],
        layout: {
          type: 'comboCombined',
          outerLayout: new Layout['grid']({
            preventOverlap: true,
            begin: [0, 0],
            preventOverlapPadding: 16
          }),
          innerLayout: new Layout['dagre']({
            sortByCombo: true,
            rankdir: 'BT',
            // sortBy: 'degree',
            preventOverlap: true,
            minNodeSpacing: 20,
            linkDistance: 50, // 可选，边长
            nodeStrength: 30, // 可选
            edgeStrength: 0.1 // 可选
            // align: 'DL',
            // ranksep: 60
          }) // rankdir: 'LR'
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
          // type: 'topo-layout'
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
          // padding: [100, 100],
          style: {
            width: width - 80,
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
          default: ['drag-node', 'custom-wheel-zoom']
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
      // 监听缩放变化
      graph.on('viewportchange', e => {
        // e 包含事件的细节，可能具有 action、matrix 等属性
        if (e.action && e.action === 'zoom') {
          const zoom = graph.getZoom();
          zoomValue.value = Math.min(zoom * 10, MAX_ZOOM);
        }
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
        console.log('-----------');
        const zoom = graph.getZoom();
        zoomValue.value = Math.min(zoom * 10, MAX_ZOOM);

        const width = graph.getWidth();
        const height = graph.getHeight();
        const combos = graph.getCombos();
        const filterCombos = combos.filter(item => !item.get('model').parentId);

        filterCombos.forEach((combo, index) => {
          // 获取 Combo 中包含的节点和边的范围
          const bbox = combo.getBBox();
          const prevBox = filterCombos[index - 1]?.getBBox?.();
          const height = graph.getHeight();
          const comboxHeight = height / combos.length;
          const padding = prevBox ? prevBox.height + 16 : 0;
          const centerY = height / 2;
          const y = prevBox ? prevBox.height : 0;
          const h = bbox.maxY - bbox.minY;

          const w = graph.getWidth();
          const updateConfig = {
            size: [w - 80, 0],
            x: w / 2,
            y: bbox.height / 2 + 40 + padding
            // style: {
            //   fill: fillColor,
            //   stroke: fillColor
            // }
          };
          // const fillColor =
          //   groups.findIndex(id => id === combo.get('model').groupId) % 2 === 1 ? '#292A2B' : '#1B1C1F';
          graph.updateItem(combo, updateConfig);
        });

        return;
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
      nextTick(() => {
        addListener(graphRef.value, onResize);
      });
    });
    onUnmounted(() => {
      graphRef.value && removeListener(graphRef.value, onResize);
    });
    const handleUpdateAggregateConfig = async config => {
      aggregateConfig.value = config.aggregate_config;
      autoAggregate.value = config.auto_aggregate;
      await getGraphData();
      renderGraph();
    };
    const handleExpandResourceChange = () => {
      showResourceGraph.value = !showResourceGraph.value;
    };
    const handleResetZoom = () => {
      zoomValue.value = 10;
      graph.zoomTo(1);
    };
    const handleZoomChange = () => {
      const value = zoomValue.value / 10;
      graph.zoomTo(value);
    };
    const handleUpdateZoom = val => {
      const value = Math.max(MIN_ZOOM, zoomValue.value + Number(val));
      zoomValue.value = Math.min(MAX_ZOOM, value);
      handleZoomChange();
    };
    return {
      nodeEntityId,
      showResourceGraph,
      topoGraphRef,
      graphRef,
      zoomValue,
      tooltipsRef,
      tooltipsModel,
      nodeEntityId,
      tooltipsType,
      handleUpdateZoom,
      handleZoomChange,
      handleResetZoom,
      handleUpdateAggregateConfig,
      handleExpandResourceChange
    };
  },
  render() {
    return (
      <div
        class='failure-topo'
        id='failure-topo'
      >
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
          <div class='failure-topo-graph-zoom'>
            <Popover
              extCls='failure-topo-graph-legend-popover'
              minWidth={214}
              boundary='parent'
              offset={{ crossAxis: 90, mainAxis: 10 }}
              trigger='click'
              arrow={false}
              theme='dark common-table'
              placement='top'
              v-slots={{
                content: (
                  <div class='failure-topo-graph-legend-content'>
                    <ul class='node-type'>
                      {NODE_TYPE.map(node => {
                        return (
                          <li>
                            <span class={['circle', node.status]}></span>
                            <span>{this.$t(node.text)}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <ul class='node-line-type'>
                      <li>
                        <span class='line'></span>
                        <span>{this.$t('从属关系')}</span>
                      </li>
                      <li>
                        <span class='line arrow'></span>
                        <span>{this.$t('调用关系')}</span>
                      </li>
                      <li>
                        <span class='line dash'></span>
                        <span>{this.$t('故障传播')}</span>
                      </li>
                    </ul>
                  </div>
                ),
                default: (
                  <div
                    class='failure-topo-graph-legend'
                    v-bk-tooltips={{ content: this.$t('显示图例'), boundary: 'parent' }}
                  >
                    <i class='icon-monitor icon-legend'></i>
                  </div>
                )
              }}
            ></Popover>
            <span class='failure-topo-graph-line'></span>
            <div class='failure-topo-graph-zoom-slider'>
              <div
                class='failure-topo-graph-setting'
                onClick={this.handleUpdateZoom.bind(this, -10)}
              >
                <i class='icon-monitor icon-minus-line'></i>
              </div>
              <Slider
                minValue={2}
                class='slider'
                v-model={this.zoomValue}
                onChange={this.handleZoomChange}
              ></Slider>
              <div
                class='failure-topo-graph-setting'
                onClick={this.handleUpdateZoom.bind(this, 10)}
              >
                <i class='icon-monitor icon-plus-line'></i>
              </div>
            </div>
            <span class='failure-topo-graph-line'></span>
            <div
              class='failure-topo-graph-proportion'
              v-bk-tooltips={{ content: this.$t('重置比例'), boundary: 'parent' }}
              onClick={this.handleResetZoom}
            >
              <i class='icon-monitor icon-mc-restoration-ratio'></i>
            </div>
          </div>
          {this.showResourceGraph && <ResourceGraph entityId={this.nodeEntityId} />}
          <div
            class='expand-resource'
            onClick={this.handleExpandResourceChange}
          >
            <i class={`icon-monitor ${this.showResourceGraph ? 'icon-arrow-right' : 'icon-mc-tree'} expand-icon`} />
          </div>
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
