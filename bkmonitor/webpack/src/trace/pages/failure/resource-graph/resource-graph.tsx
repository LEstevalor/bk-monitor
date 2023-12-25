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
import { defineComponent, onMounted, ref, shallowRef, watch, nextTick, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { Arrow, Graph, registerCombo, registerEdge, registerLayout, registerNode, Tooltip } from '@antv/g6';
import { Loading } from 'bkui-vue';
import { addListener, removeListener } from 'resize-detector';
import { debounce } from 'throttle-debounce';
import { incidentTopologyUpstream } from '../../../../monitor-api/modules/incident';
import dbsvg from '../failure-topo/db.svg';
import FailureTopoTooltips from '../failure-topo/failure-topo-tooltips';
import httpSvg from '../failure-topo/http.svg';
import { ITopoCombo, ITopoData, ITopoNode } from '../failure-topo/types';
import { useIncidentInject } from '../utils';

import { createGraphData1, EdgeStatus, NodeStatus, StatusNodeMap } from './resource-data';

import './resource-graph.scss';

export default defineComponent({
  name: 'ResourceGraph',
  props: {
    entityId: {
      type: String,
      default: '0#0.0.0.0'
    },
    content: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const graphRef = ref<HTMLDivElement | null>(null);
    const openNode = ref(null);
    const graphData = ref({});
    const route = useRoute();
    let tooltips = null;
    const tooltipsModel = shallowRef();
    const tooltipsType = ref('node');
    const tooltipsRef = ref<InstanceType<typeof FailureTopoTooltips>>();
    const incidentId = useIncidentInject();
    const loading = ref(false);
    let graph: Graph;
    const registerCustomNode = () => {
      registerNode('resource-node', {
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
              name: 'resource-node-running'
            });
            const circle2 = group.addShape('circle', {
              attrs: {
                lineWidth: 0, // 描边宽度
                cursor: 'pointer', // 手势类型
                r: 22, // 圆半径
                stroke: 'rgba(5, 122, 234, 1)'
              },
              name: 'resource-node-running'
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
              name: 'resource-node-rect'
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
              name: 'resource-node-text'
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
          const { status, aggregated_nodes } = cfg as any;
          const nodeShape = group.addShape('circle', {
            zIndex: 10,
            attrs: {
              lineWidth: 1, // 描边宽度
              cursor: 'pointer', // 手势类型
              r: 20, // 圆半径
              ...StatusNodeMap[status].groupAttrs
            },
            name: 'resource-node-shape'
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
            name: 'resource-node-img'
          });
          if (aggregated_nodes?.length) {
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
              name: 'resource-node-rect'
            });
            group.addShape('text', {
              zIndex: 11,
              attrs: {
                x: 0,
                y: 20,
                isAggregateNode: aggregated_nodes.length > 0,
                textAlign: 'center',
                textBaseline: 'middle',
                text: status === NodeStatus.Root ? '根因' : aggregated_nodes.length + 1,
                fontSize: 12,
                fill: '#fff',
                ...StatusNodeMap[status].textAttrs
              },
              name: 'resource-node-text'
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
        'resource-edge',
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
                x: midPoint.x,
                y: midPoint.y,
                textAlign: 'center',
                textBaseline: 'middle',
                text: cfg.count,
                fontSize: 12,
                fill: '#fff',
                cursor: 'pointer'
              },
              name: 'resource-node-text'
            });
          },
          update: undefined
        },
        'cubic-vertical'
      );
    };
    const registerCustomCombo = () => {
      registerCombo(
        'resource-combo',
        {
          labelPosition: 'left',
          labelAutoRotate: false,
          drawShape(cfg, group) {
            const keyShape = group.addShape('rect', {
              zIndex: 10,
              attrs: {
                fill: '#ddd',
                x: 0,
                y: 0
              },
              name: 'resource-combo-shape'
            });
            const w = graph.getWidth();
            const height = graph.getHeight();
            const combos = graphData.value.combos.filter(combos => !combos.parentId);
            const comboxHeight = height / combos.length; //graphData.value.combos.length;
            if (cfg.groupName) {
              console.info('cfg.groupName', cfg.groupName);
              group.addShape('text', {
                zIndex: 12,
                attrs: {
                  x: -w / 2 + 8,
                  y: -comboxHeight / 2,
                  textAlign: 'left',
                  text: cfg.groupName,
                  fontSize: 12,
                  fontWeight: 400,
                  fill: '#63656E'
                },
                name: 'resource-combo-title'
              });
            }
            group.addShape('text', {
              zIndex: 11,
              attrs: {
                x: -w / 2 + 8,
                y: 0,
                textAlign: 'left',
                text: cfg.title,
                fontSize: 12,
                fontWeight: 700,
                fill: '#fff'
              },
              name: 'resource-combo-text'
            });
            if (cfg.anomaly_count) {
              group.addShape('text', {
                zIndex: 11,
                attrs: {
                  x: -w / 2 + 8,
                  y: 22,
                  textAlign: 'left',
                  text: cfg.anomaly_count,
                  fontSize: 12,
                  fontWeight: 700,
                  fill: '#F55555'
                },
                name: 'resource-combo-text'
              });
            }
            group.addShape('text', {
              zIndex: 11,
              attrs: {
                x: -w / 2 + 8 + (cfg.anomaly_count ? 10 : 0),
                y: 22,
                textAlign: 'left',
                text: cfg.subTitle,
                fontSize: 12,
                fontWeight: 700,
                fill: '#979BA5'
              },
              name: 'resource-combo-text'
            });
            group.addShape('rect', {
              zIndex: 2,
              attrs: {
                x: -w / 2 + 80,
                y: -comboxHeight / 2 - 26,
                width: 2,
                height: comboxHeight + 40,
                fill: 'rgba(0, 0, 0, 0.3)'
              },
              name: 'resource-combo-bg'
            });
            return keyShape;
          }
        },
        'rect'
      );
      registerCombo(
        'resource-child-combo',
        {
          labelPosition: 'left',
          labelAutoRotate: false,
          defaultExpandAll: false
          // drawShape(cfg, group) {
          //   const keyShape = group.addShape('rect', {
          //     zIndex: 10,
          //     attrs: {
          //       fill: '#ddd',
          //       x: 0,
          //       y: 0
          //     },
          //     name: 'resource-combo-shape'
          //   });
          //   const w = graph.getWidth();
          //   const height = graph.getHeight();
          //   const comboxHeight = height / resourceData.combos.length;
          //   if (cfg.groupName) {
          //     group.addShape('text', {
          //       zIndex: 12,
          //       attrs: {
          //         x: -w / 2 + 8,
          //         y: -comboxHeight / 2,
          //         textAlign: 'left',
          //         text: cfg.groupName,
          //         fontSize: 12,
          //         fontWeight: 400,
          //         fill: '#63656E'
          //       },
          //       name: 'resource-combo-title'
          //     });
          //   }
          //   group.addShape('text', {
          //     zIndex: 11,
          //     attrs: {
          //       x: -w / 2 + 8,
          //       y: 0,
          //       textAlign: 'left',
          //       text: cfg.title,
          //       fontSize: 12,
          //       fontWeight: 700,
          //       fill: '#fff'
          //     },
          //     name: 'resource-combo-text'
          //   });
          //   group.addShape('text', {
          //     zIndex: 11,
          //     attrs: {
          //       x: -w / 2 + 8,
          //       y: 18,
          //       textAlign: 'left',
          //       text: cfg.subTitle,
          //       fontSize: 12,
          //       fontWeight: 700,
          //       fill: '#979BA5'
          //     },
          //     name: 'resource-combo-text'
          //   });
          //   group.addShape('rect', {
          //     zIndex: 2,
          //     attrs: {
          //       x: -w / 2 + 80,
          //       y: -comboxHeight / 2 - 26,
          //       width: 2,
          //       height: comboxHeight + 40,
          //       fill: 'rgba(0, 0, 0, 0.3)'
          //     },
          //     name: 'resource-combo-bg'
          //   });
          //   return keyShape;
          // }
        },
        'rect'
      );
      registerCombo(
        'custom-combo',
        {
          // setState(name, value, combo) {
          //   console.log(combo);
          // const group = combo.get('group');
          // console.log('afterUpdate==>', cfg, combo);
          // cfg.children.forEach((memberId, index) => {
          //   const childNode = group.findById(memberId);
          //   console.log('childNodechildNodechildNode', childNode);
          //   childNode.set('x', 46 + index * 10);
          //   childNode.set('y', 0);
          // });
          // },
          // afterDraw(cfg, combo) {
          // const group = combo.get('group');
          // console.log('afterUpdate==>', cfg, combo);
          // cfg.children.forEach((memberId, index) => {
          //   const childNode = group.findById(memberId);
          //   console.log('childNodechildNodechildNode', childNode);
          //   childNode.set('x', 46 + index * 10);
          //   childNode.set('y', 0);
          // });
          // },
          // labelPosition: 'left',
          // labelAutoRotate: false,
          drawShape(cfg, group) {
            const { children = [] } = cfg;
            if (cfg.collapsed) {
              const collapseIcon = (x, y, r) => {
                return [
                  ['M', x - r, y],
                  ['a', r, r, 0, 1, 0, r * 2, 0],
                  ['a', r, r, 0, 1, 0, -r * 2, 0],
                  ['M', x - r + 4, y],
                  ['L', x - r + 2 * r - 4, y]
                ];
              };
              const expandIcon = (x, y, r) => {
                return [
                  ['M', x - r, y],
                  ['a', r, r, 0, 1, 0, r * 2, 0],
                  ['a', r, r, 0, 1, 0, -r * 2, 0],
                  ['M', x - r + 4, y],
                  ['L', x - r + 2 * r - 4, y],
                  ['M', x - r + r, y - r + 4],
                  ['L', x, y + r - 4]
                ];
              };
              // 收起时的样式
              // const thirdChildNode = group.findById(cfg.aggregated_node);
              // console.log('.,===>收起时的样式,,,', thirdChildNode, '...', cfg.aggregated_node);
              // const { x, y, width, height } = thirdChildNode.getBBox();
              // const [width, height] = cfg.fixSize;
              // console.log(width, height);
              // const xRadius = width / 2 + 10;
              // const yRadius = height / 2 + 10;
              // 创建椭圆形容器
              const style = self.getShapeStyle(cfg);
              const keyShape = group.addShape('rect', {
                zIndex: 10,
                attrs: {
                  x: 0,
                  y: 0
                  // width: style.width,
                  // height: style.height
                  // opacity: 0
                },
                name: 'combo-keyShape'
              });
              const marker = group.addShape('marker', {
                zIndex: 11,
                attrs: {
                  fill: '#fff',
                  opacity: 1,
                  // cfg.style.width and cfg.style.heigth correspond to the innerWidth and innerHeight in the figure of Illustration of Built-in Rect Combo
                  x: style.width / 2,
                  y: style.height + 15,
                  r: 10,
                  symbol: collapseIcon
                },
                draggable: true,
                name: 'combo-marker-shape'
              });
              // group.addShape('rect', {
              //   zIndex: 10,
              //   attrs: {
              //     x: -240 / 2,
              //     y: -52 / 2,
              //     width: 240,
              //     height: 52,
              //     // x: 0, // 椭圆中心点 x 坐标
              //     // y: 0, // 椭圆中心点 y 坐标
              //     // rx: 240 / 2, // 水平半径
              //     // ry: 52 / 2, // 垂直半径
              //     radius: 28,
              //     fill: '#ffff'
              //     // stroke: '#de8954' // 描边颜色
              //     // lineWidth: 2, // 描边宽度
              //     // lineDash: [4, 4] // 虚线的模式，表示线段长为 4，间隔为 4
              //   },
              //   name: 'combo-keyShape2'
              // });
              // group.addShape('text', {
              //   zIndex: 11,
              //   attrs: {
              //     x: -10 / 2 + 8,
              //     y: 22,
              //     textAlign: 'left',
              //     text: 12312222131231233,
              //     fontSize: 12,
              //     fontWeight: 700,
              //     fill: '#F55555'
              //   },
              //   name: 'resource-combo-text'
              // });
              // // 将子节点放置在容器内部
              // const offsetX = x - xRadius;
              // const offsetY = y - yRadius;
              // children.forEach((memberId, index) => {
              //   const childNode = group.findById(memberId);
              //   childNode.set('x', offsetX + index * 10);
              //   childNode.set('y', offsetY);
              // });

              // 添加展开图标
              // group.addShape('circle', {
              //   attrs: {
              //     x: x + xRadius,
              //     y,
              //     r: 10,
              //     fill: 'green',
              //     cursor: 'pointer'
              //   },
              //   name: 'combo-expand-icon'
              // });

              return keyShape;
            }

            // else {
            //   console.log('.,===>,,,');
            //   // 展开时的样式
            //   const padding = 10;
            //   let comboWidth = 0;
            //   let comboHeight = 0;

            //   children.forEach((memberId, index) => {
            //     const childNode = group.findById(memberId);
            //     const { width, height } = childNode.getBBox();
            //     childNode.set('x', comboWidth);
            //     childNode.set('y', 0);

            //     comboWidth += width;
            //     comboHeight = Math.max(comboHeight, height);
            //   });

            //   comboWidth += (children.length - 1) * padding;

            //   // 创建容器椭圆虚线边样式
            //   const keyShape = group.addShape('ellipse', {
            //     attrs: {
            //       x: comboWidth / 2,
            //       y: comboHeight / 2,
            //       rx: comboWidth / 2 + padding,
            //       ry: comboHeight / 2 + padding,
            //       fill: 'none',
            //       stroke: 'blue',
            //       lineDash: [4, 4]
            //     },
            //     name: 'combo-keyShape',
            //     draggable: true
            //   });

            //   // 添加收起图标
            //   group.addShape('circle', {
            //     attrs: {
            //       x: comboWidth,
            //       y: 0,
            //       r: 10,
            //       fill: 'red',
            //       cursor: 'pointer'
            //     },
            //     name: 'combo-collapse-icon'
            //   });

            //   return keyShape;
            // }
          }
        },
        'rect'
      );
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
            const targetModel = graphData.value.nodes.find(item => item.id === model.target);
            const sourceModel = graphData.value.nodes.find(item => item.id === model.source);
            tooltipsModel.value = [targetModel, sourceModel];
          } else {
            tooltipsModel.value = model as ITopoNode;
          }
          tooltipsType.value = type;
          return tooltipsRef.value.$el;
        }
      });
    };
    const registerCustomLayout = () => {
      registerLayout('resource-layout', {
        execute() {
          // console.info('execute', this);
          const { nodes, combos } = this;
          const nodeBegin = 80;
          const width = graph.getWidth() - nodeBegin - 100;
          const height = graph.getHeight();
          const combosArr = graphData.value.combos.filter(combos => !combos.parentId);
          const comboxHeight = height / combosArr.length; //combos.length;
          // console.info(
          //   combos.filter(item => !item.parentId),
          //   height,
          //   comboxHeight,
          //   '=========='
          // );
          const nodeSize = 46;
          combos
            .filter(item => !item.parentId)
            .forEach((combo, comboIndex) => {
              const comboNodes = nodes.filter(node => node.comboId.toString() === combo.id.toString());
              const xBegin = nodeBegin + nodeSize / 2;
              const yBegin = comboxHeight / 2 + comboIndex * comboxHeight;
              const nodeStep = width / comboNodes.length;
              comboNodes.forEach((node, index) => {
                // node.fixSize = [width, comboxHeight];
                node.x = xBegin + index * nodeStep;
                node.y = yBegin + 22;
              });
              const childCombo = combos.find(item => item.parentId === combo.id);
              if (childCombo) {
                return;
                const childNodes = nodes.filter(node => node.comboId.toString() === childCombo.id.toString());
                console.log(childNodes, '...childNodes');
                // debugger;
                childNodes.forEach((node, index) => {
                  console.log(6 + index * nodeSize, '6 + index + nodeSize');

                  node.x = 6 + index * nodeSize;
                  node.y = 0;
                });
              }
            });
        }
      });
    };
    const getTopologyUpstream = () => {
      if (!props.entityId) {
        return;
      }
      incidentTopologyUpstream({ id: incidentId.value, entity_id: props.entityId })
        .then(res => {
          loading.value = true;
          const { ranks, edges } = res;
          const ranksMap = {};
          // console.log(res);
          // const l = [ranks[0]];
          ranks.forEach(rank => {
            if (ranksMap[rank.rank_category.category_name]) {
              ranksMap[rank.rank_category.category_name].push(rank);
            } else {
              ranksMap[rank.rank_category.category_name] = [rank];
            }
          });
          // nodeData.value = res;
          graphData.value = createGraphData1(ranksMap, edges); // createGraphData(res);
          graph.data(JSON.parse(JSON.stringify(graphData.value)));
          graph.render();
          // console.log(res, getRawData(), combos.value, createGraphData(res));
        })
        .catch(err => {})
        .finally(() => {
          setTimeout(() => {
            loading.value = false;
          }, 300);
        });
    };
    watch(
      () => props.entityId,
      () => {
        getTopologyUpstream();
      },
      { immediate: true }
    );
    const init = () => {
      const { width, height } = graphRef.value.getBoundingClientRect();
      console.info('width', width, height);
      registerCustomNode();
      registerCustomEdge();
      registerCustomCombo();
      registerCustomTooltip();
      registerCustomLayout();
      graph = new Graph({
        container: graphRef.value,
        width,
        height,
        fitView: false,
        fitViewPadding: 0,
        groupByTypes: false,
        plugins: [tooltips],
        layout: {
          type: 'resource-layout'
        },
        defaultNode: {
          type: 'circle',
          size: 40,
          style: {
            cursor: 'pointer'
          }
        },
        defaultEdge: {
          type: 'cubic-vertical',
          size: 1,
          color: '#63656D',
          cursor: 'pointer'
        },
        defaultCombo: {
          // type: 'rect',
          type: 'resource-combo',
          style: {
            fill: '#292A2B',
            radius: 0,
            lineWidth: 0
          }
        },
        modes: {
          default: []
        }
      });
      graph.node(node => {
        return {
          ...node,
          type: 'resource-node'
        };
      });
      graph.edge((cfg: any) => {
        const isInvoke = cfg.type === EdgeStatus.Invoke;
        const edg = {
          ...cfg,
          shape: 'cubic-vertical',
          style: {
            cursor: 'pointer',
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
            // fill: isInvoke ? '#F55555' : '#63656E',
            stroke: isInvoke ? '#F55555' : '#63656E',
            lineWidth: isInvoke ? 2 : 1,
            lineDash: isInvoke ? [4, 2] : false
          }
        };
        if (!cfg.color) return edg;
        return {
          ...edg,
          shape: 'cubic-vertical',
          type: 'resource-edge',
          cursor: 'pointer'
        };
      });
      graph.combo(combo => {
        if (combo.parentId) {
          return {
            ...combo,
            type: 'custom-combo'
          };
        }
        return {
          ...combo,
          type: 'resource-combo'
        };
      });
      graph.on('afterlayout', () => {
        const combos = graph.getCombos();
        const groups = Array.from(new Set(combos.map(combo => combo.get('model').groupId)));
        const filterCombos = combos.filter(item => !item.get('model').parentId);

        filterCombos.forEach((combo, index) => {
          // 获取 Combo 中包含的节点和边的范围
          const bbox = combo.getBBox();
          const height = graph.getHeight();
          const comboxHeight = height / combos.length;
          const h = bbox.maxY - bbox.minY;
          const w = graph.getWidth();
          const updateConfig = {
            fixSize: [w, comboxHeight],
            x: w / 2
            // style: {
            //   fill: fillColor,
            //   stroke: fillColor
            // }
          };
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
            graph.updateItem(childCombo, {
              // fixSize: [w, 108],
              x: combo.getBBox().width - 30,
              y: 108 / 2 + 16
            });
          }
        });
      });
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
      graph.on('combo:click', () => {
        tooltips.hide();
      });
      graph.on('node:click', e => {
        const nodeItem = e.item;
        const { status } = nodeItem.getModel() as any;
        if (status === NodeStatus.Root) {
          graph.setItemState(nodeItem, 'running', true);
          return;
        }

        return;
        const { item, target } = e;
        if (target.cfg.name !== 'resource-node-rect') return;
        const { comboId, aggregated_nodes, id } = item.get('model');
        if (target.cfg.name === 'resource-node-text') {
          return;
        }
        openNode.value = item.get('model');
        const rawData = getRawData();
        rawData.combos.push({
          id: 'resource-child-combo',
          parentId: comboId,
          zIndex: 13,
          style: {
            fill: '#1B1C1F',
            stroke: '#979797',
            lineWidth: 1,
            lineDash: [4, 2]
          }
        });
        /** 将节点打开 */
        rawData.nodes.push(
          ...aggregated_nodes.map(node => ({
            ...node,
            type: 'resource-node',
            comboId: 'resource-child-combo',
            aggregateId: id
          }))
        );
        /** 将聚合节点删除 */
        rawData.nodes = rawData.nodes.filter(node => node.id !== id);
        console.info('node:click', rawData);
        setTimeout(() => {
          graph.collapseCombo('resource-child-combo');
        }, 3000);
        graph.data(rawData);
        graph.render();
        // graph.addItem('combo', {
        //   id: 'resource-child-combo',
        //   parentId: comboId,
        //   zIndex: 13,
        //   style: {
        //     fill: '#1B1C1F',
        //     stroke: '#979797',
        //     lineWidth: 1,
        //     lineDash: [4, 2]
        //   }
        // });
        // aggregated_nodes?.forEach(item => {
        //   graph.addItem('node', {
        //     ...item,
        //     type: 'resource-node',
        //     comboId: 'resource-child-combo'
        //   });
        // });
        console.info('node:click', e, item);
      });
      // graph.data(graphData.value);
      // graph.render();
    };
    function handleResize() {
      if (!graph || graph.get('destroyed') || !graphRef.value) return;
      const { height } = document.querySelector('.resource-graph').getBoundingClientRect();
      const { width, height: cHeight } = graphRef.value.getBoundingClientRect();
      tooltipsRef?.value?.hide?.();
      tooltips?.hide?.();
      graph.changeSize(width, Math.max(160 * graphData.value.combos.length, height - 40));
      graph.render();
    }
    const onResize = debounce(300, handleResize);
    onMounted(() => {
      init();
      nextTick(() => {
        addListener(graphRef.value, onResize);
      });
    });
    onUnmounted(() => {
      graphRef.value && removeListener(graphRef.value, onResize);
    });
    return {
      graphRef,
      tooltipsRef,
      tooltipsModel,
      tooltipsType,
      loading,
      graph
    };
  },
  render() {
    return (
      <div class='resource-graph'>
        <Loading
          class='resource-graph-loading'
          loading={this.loading}
          color='#292A2B'
        >
          <div
            ref='graphRef'
            class='graph-wrapper'
          />
        </Loading>
        <div style='display: none'>
          <FailureTopoTooltips
            ref='tooltipsRef'
            showViewResource={false}
            model={this.tooltipsModel}
            type={this.tooltipsType}
          />
        </div>
      </div>
    );
  }
});
