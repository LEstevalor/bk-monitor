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
import { defineComponent, onMounted, ref, shallowRef, watch } from 'vue';
import { Arrow, Graph, registerCombo, registerEdge, registerLayout, registerNode, Tooltip } from '@antv/g6';

import { incidentTopologyUpstream } from '../../../../monitor-api/modules/incident';
import dbsvg from '../failure-topo/db.svg';
import FailureTopoTooltips from '../failure-topo/failure-topo-tooltips';
import httpSvg from '../failure-topo/http.svg';

import resourceData, {
  createGraphData,
  createGraphData1,
  EdgeStatus,
  NodeStatus,
  StatusNodeMap
} from './resource-data';

import './resource-graph.scss';

export default defineComponent({
  name: 'ResourceGraph',
  props: {
    entityId: {
      type: String,
      default: '0#0.0.0.0'
    },
    bizId: {
      type: String,
      default: '2'
    },
    id: {
      type: String,
      default: '17024603108'
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
    let tooltips = null;
    const tooltipsModel = shallowRef();
    const tooltipsType = ref('node');
    const tooltipsRef = ref<InstanceType<typeof FailureTopoTooltips>>();

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
          console.log(cfg, 'aggregated_nodesaggregated_nodes');
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
            console.log(height, graphData.value.combos.length, '====>');
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
      // registerCombo(
      //   'custom-combo',
      //   {

      //     }
      //   },
      //   'rect'
      // );
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
          tooltipsModel.value = model;
          tooltipsType.value = type;
          return tooltipsRef.value.$el;
        }
      });
    };
    const registerCustomLayout = () => {
      registerLayout('resource-layout', {
        execute() {
          console.info('execute', this);
          const { nodes, combos } = this;
          console.log(combos);
          const nodeBegin = 80;
          const width = graph.getWidth() - nodeBegin - 100;
          const height = graph.getHeight();
          const combosArr = graphData.value.combos.filter(combos => !combos.parentId);
          const comboxHeight = height / combosArr.length; //combos.length;
          console.info(
            combos.filter(item => !item.parentId),
            height,
            comboxHeight,
            '=========='
          );
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
              console.log(childCombo, '...');
              if (childCombo) {
                return;
                const childNodes = nodes.filter(node => node.comboId.toString() === childCombo.id.toString());
                console.log(childNodes, '...childNodes');
                // debugger;
                childNodes.forEach((node, index) => {
                  console.log(6 + index * nodeSize, '6 + index + nodeSize');

                  node.x = 6 + index * nodeSize;
                  node.y = 52 / 2;
                });
              }
            });
        }
      });
    };
    const getTopologyUpstream = () => {
      incidentTopologyUpstream({ id: props.id, bk_biz_id: props.bizId, entity_id: props.entityId })
        .then(res => {
          const { ranks, edges } = res;
          const ranksMap = {};
          console.log(res);
          ranks.forEach(rank => {
            if (ranksMap[rank.rank_category.category_name]) {
              ranksMap[rank.rank_category.category_name].push(rank);
            } else {
              ranksMap[rank.rank_category.category_name] = [rank];
            }
          });
          // nodeData.value = res;
          graphData.value = createGraphData1(ranksMap, edges); // createGraphData(res);
          console.log(graphData.value, '..graphData.value.');
          init();
          // console.log(res, getRawData(), combos.value, createGraphData(res));
        })
        .catch(err => {})
        .finally(() => {});
    };
    watch(
      () => props.id,
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
      console.log(tooltips, '..tooltips...');
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
          size: 40
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
          default: ['drag-combo', 'drag-node', 'drag-canvas', 'zoom-canvas']
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
        console.log(combos, 'afterlayout');
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
            console.log('childCombochildCombo', childCombo, combo.getBBox(), combo);
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
        console.log('---');
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
        console.log('=====', target, item, item.get('model'));
        if (target.cfg.name !== 'resource-node-rect') return;
        const { comboId, aggregated_nodes, id } = item.get('model');
        if (target.cfg.name === 'resource-node-text') {
          console.log('sadasd');
          return;
        }
        openNode.value = item.get('model');
        const rawData = getRawData();
        console.log(rawData, '...===>');
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
      setTimeout(() => {
        graph.data(graphData.value);
        graph.render();
      }, 1000);
      // graph.data(graphData.value);
      // graph.render();
    };

    onMounted(() => {
      // init();
    });
    return {
      graphRef,
      tooltipsRef,
      tooltipsModel,
      tooltipsType,
      graph
    };
  },
  render() {
    return (
      <div class='resource-graph'>
        <div
          ref='graphRef'
          class='graph-wrapper'
        />
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
