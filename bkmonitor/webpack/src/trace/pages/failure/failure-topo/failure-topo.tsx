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
import dbsvg from './db.svg';
import FailureTopoTooltips from './failure-topo-tooltips';
import httpSvg from './http.svg';
import TopoTools from './topo-tools';
import { ITopoCombo, ITopoData, ITopoNode } from './types';
import { getNodeAttrs } from './utils';
import FeedbackCauseDialog from './feedback-cause-dialog';
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
    const MIN_ZOOM = 5;
    const MAX_ZOOM = 30;
    const tooltipsModel = shallowRef<ITopoNode | ITopoNode[]>();
    const tooltipsType = ref('node');
    const tooltipsRef = ref<InstanceType<typeof FailureTopoTooltips>>();
    let topoRawData: ITopoData = null;
    const autoAggregate = ref(true);
    const aggregateConfig = ref({});
    const showLegend = ref(true);
    const feedbackCauseShow = ref(false);
    const feedbackModel = ref({});
    const incidentId = useIncidentInject();
    const nodeEntityId = ref('');
    let activeAnimation = [];
    let activeNode = null;
    let resourceNodeId = null;
    const zoomValue = ref(0);
    const showResourceGraph = ref(false);
    /** 检测文字长度 */
    const accumulatedWidth = text => {
      const maxWidth = 150; // 设定的最大文本宽度
      const context = graph.get('canvas').get('context'); // 获取canvas上下文用于测量文本
      let textWidth = context.measureText(text).width;

      if (textWidth > maxWidth) {
        let truncatedText = '';
        let accumulatedWidth = 0;

        // 逐个字符检查，直到累计宽度超过最大宽度，然后截断
        for (let char of text) {
          accumulatedWidth += context.measureText(char).width;
          if (accumulatedWidth > maxWidth) break;
          truncatedText += char;
        }
        return `${truncatedText}...`;
      }
      return text;
    };
    const registerCustomNode = () => {
      registerNode('topo-node', {
        afterDraw(cfg, group) {
          const nodeAttrs = getNodeAttrs(cfg as ITopoNode);
          if ((cfg as ITopoNode).entity.is_root || (cfg as ITopoNode).is_feedback_root) {
            console.log('asdassadsdasadads');
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
            // circle2.animate(
            //   {
            //     lineWidth: 6,
            //     r: 24,
            //     strokeOpacity: 0.3
            //   },
            //   {
            //     repeat: true, // 循环
            //     duration: 3000,
            //     // easing: 'easeCubic',
            //     delay: 100 // 无延迟
            //   }
            // );
          }
        },
        draw(cfg, group) {
          const { entity, aggregated_nodes, anomaly_count, is_feedback_root } = cfg as ITopoNode;
          const nodeAttrs = getNodeAttrs(cfg as ITopoNode);
          const nodeShape = group.addShape('circle', {
            zIndex: 10,
            attrs: {
              lineWidth: 1, // 描边宽度
              cursor: 'pointer', // 手势类型
              r: 20, // 圆半径
              ...nodeAttrs.groupAttrs
            },
            draggable: true,
            name: 'topo-node-shape'
          });
          group.addShape('image', {
            zIndex: 12,
            attrs: {
              x: -12,
              y: -12,
              width: 24,
              height: 24,
              cursor: 'pointer', // 手势类型
              img: entity.is_anomaly ? dbsvg : httpSvg // 图片资源
            },
            draggable: true,
            name: 'topo-node-img'
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
          if (aggregated_nodes?.length) {
            group.addShape('rect', {
              zIndex: 10,
              attrs: {
                x: -17,
                y: 12,
                width: 32,
                height: 16,
                radius: 8,
                fill: '#fff',
                ...nodeAttrs.rectAttrs
              },
              name: 'topo-node-rect'
            });
            (anomaly_count as number) > 0 &&
              group.addShape('text', {
                zIndex: 11,
                attrs: {
                  x: -9,
                  y: 20,
                  textAlign: 'center',
                  textBaseline: 'middle',
                  text: anomaly_count,
                  fontSize: 11,
                  fill: '#F55555',
                  ...nodeAttrs.textAttrs
                },
                name: 'topo-node-err-text'
              });
            (anomaly_count as number) > 0 &&
              group.addShape('text', {
                zIndex: 11,
                attrs: {
                  x: -2,
                  y: 20,
                  textAlign: 'center',
                  textBaseline: 'middle',
                  text: '/',
                  fontSize: 11,
                  fill: '#979BA5',
                  ...nodeAttrs.textAttrs
                },
                name: 'topo-node-err-text'
              });

            group.addShape('text', {
              zIndex: 11,
              attrs: {
                x: 0 + ((anomaly_count as number) > 0 ? 5 : 0),
                y: 20,
                textAlign: 'center',
                textBaseline: 'middle',
                text: entity.is_root || is_feedback_root ? '根因' : aggregated_nodes.length + 1,
                fontSize: 11,
                fill: '#fff',
                ...nodeAttrs.textAttrs
              },
              name: 'topo-node-text'
            });
          }
          group.addShape('text', {
            zIndex: 11,
            attrs: {
              x: 0,
              y: aggregated_nodes?.length || entity.is_root || is_feedback_root ? 36 : 28,
              textAlign: 'center',
              textBaseline: 'middle',
              text: accumulatedWidth(entity.entity_name),
              fontSize: 10,
              fill: entity.is_root || is_feedback_root ? '#F55555' : entity.is_anomaly ? '#FD9C9C' : '#979BA5'
            },
            name: 'topo-node-err-text'
          });
          group.sort();
          return nodeShape;
        },
        setState(name, value, item) {
          const group = item.getContainer();
          if (name === 'hover') {
            const shape = group.find(e => e.get('name') === 'topo-node-shape');
            // box-shadow: 0 2px 6px 0 rgba(0, 0, 0, 0.5);
            shape?.attr({
              shadowColor: value ? 'rgba(0, 0, 0, 0.5)' : false,
              shadowBlur: value ? 6 : false,
              shadowOffsetX: value ? 0 : false,
              shadowOffsetY: value ? 2 : false,
              strokeOpacity: value ? 0.6 : 1,
              cursor: 'pointer' // 手势类型
            });
          } else if (name === 'running') {
            const runningShape = group.find(e => e.get('name') === 'topo-node-running');
            if (value) {
              runningShape.animate(
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
              const animateCycle = () => {
                const end = () => {
                  activeAnimation.push(
                    runningShape?.animate(
                      {
                        r: 24,
                        // opacity: 1
                        strokeOpacity: 0.1
                      },
                      {
                        duration: 1500, // 缩小的动画持续时间更长，以产生前放后缩的效果
                        easing: 'easeCubic',
                        callback: animateCycle // 动画完成后递归调用以循环执行
                      }
                    )
                  );
                };
                activeAnimation.push(
                  runningShape?.animate(
                    {
                      stroke: 'rgba(5, 122, 234, 1)',
                      lineWidth: 6,
                      r: shape.attr('r') + 2,
                      strokeOpacity: 0.3
                      // opacity: 1
                    },
                    {
                      // repeat: true, // 循环
                      duration: 2000,
                      easing: 'easeCubic',
                      delay: 0, // 无延迟
                      callback: end
                    }
                  )
                );
              };
            } else {
              runningShape.stopAnimate();
              runningShape.attr({
                lineWidth: 0, // 描边宽度
                cursor: 'pointer', // 手势类型
                r: 22, // 圆半径
                stroke: 'rgba(5, 122, 234, 1)'
              });
              console.log('activeAnimationactiveAnimationactiveAnimation', activeAnimation);
              activeAnimation.forEach(animation => animation?.stop?.());
              activeAnimation = [];
            }
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
                cursor: 'pointer',
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
                cursor: 'pointer',
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
      registerBehavior('drag-node-with-fixed-combo', {
        getEvents() {
          return {
            'node:dragstart': 'onDragStart',
            'node:drag': 'onDrag',
            'node:dragend': 'onDragEnd'
          };
        },
        onDragStart(e) {
          const { item } = e;
          const combos = graph.getCombos();
          // combos.forEach(combo => {
          //   // 存储原始宽度
          //   combo.getModel().originalSize = combo.getKeyShape().getCanvasBBox().width;
          // });
          // 存储当前节点所在的 combo ID
          if (item.get('type') === 'node') {
            const model = item.getModel();
            const combo = combos.find(combo => combo.getID() === model.comboId);
            this.currentComboId = combo ? combo.getID() : null;
          }
        },
        onDrag(e) {
          const { item, x, y } = e;
          if (this.currentComboId) {
            const combos = graph.getCombos();
            const combo = combos.find(combo => combo.getID() === this.currentComboId);
            const comboBBox = combo.getBBox();
            const nodeSize = 40; // 假设节点的边长为40
            // 获取节点内名为'topo-node-err-text'的Shape
            const errTextShape = item.get('group').find(s => s.get('name') === 'topo-node-err-text');
            // 获取该Shape相对于画布的边界框
            const shapeBBox = errTextShape.getBBox();
            const nodeCenter = {
              x: x,
              y: y
            };
            // 根据节点中心位置和边长计算出节点的新边界框
            const newNodeBBox = {
              minX: nodeCenter.x - shapeBBox.width / 2,
              maxX: nodeCenter.x + shapeBBox.width / 2,
              minY: nodeCenter.y - nodeSize / 2,
              maxY: nodeCenter.y + (nodeSize + shapeBBox.height + shapeBBox.y) / 2
            };

            // 检查新的中心位置是否在Combo边界内
            const isXInside = newNodeBBox.minX >= comboBBox.minX && newNodeBBox.maxX <= comboBBox.maxX;
            const isYInside = newNodeBBox.minY >= comboBBox.minY && newNodeBBox.maxY <= comboBBox.maxY;

            if (isXInside && isYInside) {
              // 如果节点新位置还在Combo内，可以移动
              item.toFront(); // 如果需要的话可以让节点到最前方显示
              graph.updateItem(item, {
                x,
                y
              });
            } else {
              return false;
            }
          }
        },
        onDragEnd(e) {
          // 清楚临时信息
          delete this.currentComboId;
        }
      });
      registerBehavior('custom-wheel-zoom', {
        getEvents() {
          return {
            wheel: 'onWheel'
          };
        },
        onWheel(evt) {
          // 阻止默认的滚动行为
          evt.preventDefault();
          return;
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
          return;
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
            // nodeEntityId.value = tooltipsModel.value.entity.entity_id;
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
      console.log(width, 'weqeqeqweqwqwe');
      tooltipsRef?.value?.hide?.();
      tooltips?.hide?.();
      graph.changeSize(width, Math.max(160 * topoRawData.combos.length, height - 40));
      graph.render();
      /** 打开时会触发导致动画消失 */
      if (resourceNodeId) {
        const node = graph.findById(resourceNodeId);
        node && graph.setItemState(node, 'running', true);
      }
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
      const rootNode = topoRawData.nodes.find(node => node.entity.is_root);
      if (rootNode) {
        activeNode = rootNode;
        resourceNodeId = rootNode.id;
        nodeEntityId.value = rootNode.id;
      }
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
          color: '#63656D',
          style: {
            cursor: 'pointer'
          }
        },
        defaultCombo: {
          type: 'rect',
          refX: 20,
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
          default: [
            'drag-node-with-fixed-combo',
            // {
            //   type: 'drag-node',
            //   onlyChangeComboSize: true
            // },

            {
              type: 'drag-canvas',
              scalableRange: -1
            },
            {
              type: 'scroll-canvas',
              scalableRange: -1,
              allowDrag: e => {
                if (e.ctrlKey) return false;
                return true;
              }
            },
            'custom-wheel-zoom'
          ]
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
            cursor: 'pointer',
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
          // zoomValue.value = Math.min(zoom * 10, MAX_ZOOM);
        }
      });
      // 监听鼠标离开节点
      graph.on('node:mouseleave', e => {
        const nodeItem = e.item;
        graph.setItemState(nodeItem, 'hover', false);
      });
      graph.on('node:click', e => {
        const nodeItem = e.item;
        activeNode = nodeItem;
        // console.log(nodeItem, activeNode);
        // const { entity } = nodeItem.getModel() as ITopoNode;

        // graph.setItemState(nodeItem, 'running', true);
        // console.log(shape, '====>', activeNode);
      });
      graph.on('mouseenter', e => {
        const canvas = graph.get('canvas');
        const el = canvas.get('el'); // 获取到画布实际的 DOM 元素
        el.style.cursor = 'grab'; // 设置光标为 'grab'
      });

      graph.on('mousedown', e => {
        const canvas = graph.get('canvas');
        const el = canvas.get('el');
        el.style.cursor = 'grabbing'; // 鼠标按下时设置光标为 'grabbing'
      });

      graph.on('mouseup', e => {
        const canvas = graph.get('canvas');
        const el = canvas.get('el');
        el.style.cursor = 'grab'; // 鼠标释放回复 'grab' 样式
      });

      graph.on('mouseleave', e => {
        const canvas = graph.get('canvas');
        const el = canvas.get('el');
        el.style.cursor = ''; // 恢复默认光标
      });
      graph.on('combo:click', () => {
        tooltipsRef.value.hide();
        tooltips.hide();
      });
      const calculateFitScale = (combos, maxWidth) => {
        let maxComboWidth = 0;
        combos.forEach(combo => {
          const bbox = combo.getBBox();
          if (bbox.width > maxComboWidth) {
            maxComboWidth = bbox.width;
          }
        });

        // 如果最大combo宽度超出了画布宽度，计算缩放比例
        if (maxComboWidth > maxWidth) {
          // 自动缩小比例最小到0.5 超过0.5已经不能看清，采用画布拖放即可
          const Scale = maxWidth / maxComboWidth;
          zoomValue.value = Scale * 10;
          Scale > 0.5 && graph.zoomTo(Scale);
        }
      };
      graph.on('afterlayout', () => {
        const zoom = graph.getZoom();
        zoomValue.value = Math.min(zoom * 10, MAX_ZOOM);
        const width = graph.getWidth();
        const combos = graph.getCombos();
        const filterCombos = combos.filter(item => !item.get('model').parentId);

        filterCombos.forEach((combo, index) => {
          const bbox = combo.getBBox();
          // 获取 Combo 中包含的节点和边的范围
          const prevBox = filterCombos[index - 1]?.getBBox?.();
          const padding = prevBox ? prevBox.height + 16 : 0;
          const w = graph.getWidth();

          /** 先调整宽度，再进行位置判断，如果是窗口变化默认进入拿到的宽度会瘦窗口前的宽度 */
          setTimeout(() => {
            const bbox = combo.getBBox();
            console.log(bbox.width, width);
            graph.updateItem(combo, {
              x: bbox.width > width ? bbox.width / 2 : width / 2
            });
          }, 50);
          graph.updateItem(combo, {
            size: [w - 40, 0],
            y: bbox.height / 2 + padding
          });
        });
        console.log(calculateFitScale(filterCombos, width), 'calculateFitScalecalculateFitScale');
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
    const handleViewResource = model => {
      const activeModel = activeNode.getModel() as ITopoNode;
      console.log(activeModel, model, '======>', activeNode);
      // activeNode
      if (!showResourceGraph.value) {
        showResourceGraph.value = !showResourceGraph.value;
      } else {
        const node = graph.findById(model.id);
        graph.setItemState(node, 'running', true);
      }
      if (resourceNodeId && resourceNodeId !== model.id) {
        const node = graph.findById(resourceNodeId);
        graph.setItemState(node, 'running', false);
      }
      resourceNodeId = model.id;
      console.log(resourceNodeId);
      nodeEntityId.value = model.entity.entity_id;
      activeNode = null;
      tooltipsRef.value.hide();
      tooltips.hide();
    };
    /** 反馈新根因， 反馈后需要重新调用接口拉取数据 */
    const handleFeedBack = model => {
      feedbackCauseShow.value = true;
      feedbackModel.value = model;
      tooltipsRef.value.hide();
      tooltips.hide();
    };
    const handleUpdateAggregateConfig = async config => {
      aggregateConfig.value = config.aggregate_config;
      autoAggregate.value = config.auto_aggregate;
      await getGraphData();
      renderGraph();
    };
    const handleExpandResourceChange = () => {
      showResourceGraph.value = !showResourceGraph.value;
      // if (!showResourceGraph.value) {
      //   graph.setItemState(activeNode, 'running', false);
      //   activeNode = null;
      // }
    };
    const handleResetZoom = () => {
      zoomValue.value = 10;
      graph.zoomTo(1);
    };
    const handleZoomChange = value => {
      if (graph?.zoomTo) {
        graph.zoomTo(value / 10);
      }
    };
    const handleUpdateZoom = val => {
      const value = Math.max(MIN_ZOOM, zoomValue.value + Number(val));
      zoomValue.value = Math.min(MAX_ZOOM, value);
      handleZoomChange(zoomValue.value);
    };
    const handleShowLegend = () => {
      showLegend.value = !showLegend.value;
    };
    const handleFeedBackChange = async value => {
      if (value) {
        await getGraphData();
        renderGraph();
      }
      feedbackCauseShow.value = false;
    };
    return {
      nodeEntityId,
      showResourceGraph,
      topoGraphRef,
      graphRef,
      zoomValue,
      tooltipsRef,
      showLegend,
      tooltipsModel,
      feedbackCauseShow,
      feedbackModel,
      nodeEntityId,
      tooltipsType,
      handleFeedBackChange,
      handleFeedBack,
      handleShowLegend,
      handleViewResource,
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
            class='topo-graph-wrapper-padding'
            style={{ width: this.showResourceGraph ? '70%' : '100%' }}
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
                renderType='auto'
                offset={{ crossAxis: 90, mainAxis: 10 }}
                trigger='manual'
                always={true}
                isShow={this.showLegend}
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
                      onClick={this.handleShowLegend}
                      class='failure-topo-graph-legend'
                      v-bk-tooltips={{
                        content: this.$t('显示图例'),
                        disabled: this.showLegend,
                        boundary: () => document.getElementById('#failure-topo')
                      }}
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
                  onClick={this.handleUpdateZoom.bind(this, -2)}
                >
                  <i class='icon-monitor icon-minus-line'></i>
                </div>
                <Slider
                  minValue={5}
                  maxValue={20}
                  class='slider'
                  v-model={this.zoomValue}
                  onUpdate:modelValue={this.handleZoomChange}
                  onChange={this.handleZoomChange}
                ></Slider>
                <div
                  class='failure-topo-graph-setting'
                  onClick={this.handleUpdateZoom.bind(this, 2)}
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
            <div
              class='expand-resource'
              onClick={this.handleExpandResourceChange}
            >
              <i class={`icon-monitor ${this.showResourceGraph ? 'icon-arrow-right' : 'icon-mc-tree'} expand-icon`} />
            </div>
          </div>
          {this.showResourceGraph && <ResourceGraph entityId={this.nodeEntityId} />}
        </div>
        <FeedbackCauseDialog
          visible={this.feedbackCauseShow}
          onChange={this.handleFeedBackChange}
          data={this.feedbackModel}
        ></FeedbackCauseDialog>
        <div style='display: none'>
          <FailureTopoTooltips
            ref='tooltipsRef'
            model={this.tooltipsModel}
            type={this.tooltipsType}
            onFeedBack={this.handleFeedBack}
            onViewResource={this.handleViewResource}
          />
        </div>
      </div>
    );
  }
});
