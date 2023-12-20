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
import { defineComponent, ref, shallowRef, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { incidentTopologyMenu } from '@api/modules/incident';
import { random } from '@common/utils/utils';

import { useIncidentInject } from '../utils';

import AggregationSelect from './aggregation-select';

import './topo-tools.scss';

const fullscreenHelper = (function () {
  // 全屏请求的兼容性封装
  function requestFullscreen(element) {
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
      element.msRequestFullscreen();
    } else {
      console.error('Fullscreen API is not supported in this browser');
    }
  }

  // 全屏退出的兼容性封装
  function exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else {
      console.error('Fullscreen API is not supported in this browser');
    }
  }

  // 监听全屏事件的处理
  function onFullscreenChange(handler) {
    document.addEventListener('fullscreenchange', handler, false);
    document.addEventListener('webkitfullscreenchange', handler, false);
    document.addEventListener('mozfullscreenchange', handler, false);
    document.addEventListener('MSFullscreenChange', handler, false);
  }

  return {
    requestFullscreen: requestFullscreen,
    exitFullscreen: exitFullscreen,
    onFullscreenChange: onFullscreenChange
  };
})();

export default defineComponent({
  name: 'TopoTools',
  emits: ['update:AggregationConfig'],
  setup(props, { emit }) {
    const treeData = shallowRef([]);
    const checkedIds = ref([]);
    const autoAggregate = ref(true);
    const isFullscreen = ref(false);
    const { t } = useI18n();
    const aggregateConfig = ref({});
    const incidentId = useIncidentInject();
    incidentTopologyMenu({
      id: incidentId.value
    }).then(data => {
      treeData.value = data.map(item => {
        return {
          ...item,
          id: random(10),
          name: item.entity_type,
          children: item.aggregate_bys?.map(child => {
            const name = child.aggreate_key
              ? t(`按 {0} 聚合`, [child.aggreate_key])
              : `${`${t('聚合异常')}${item.entity_type}`}  (${child.count})`;
            return {
              ...child,
              parentId: item.id,
              id: random(10),
              name
            };
          })
        };
      });
    });
    const setTreeDataChecked = () => {
      const config = {};
      treeData.value = treeData.value.map(item => {
        return {
          ...item,
          checked: checkedIds.value.includes(item.id),
          children: item.children?.map(child => {
            const checked = checkedIds.value.includes(child.id);
            if (checked) {
              if (!config[item.entity_type]) {
                config[item.entity_type] = {
                  aggregate_keys: [],
                  aggregate_anomaly: false
                };
              }
              if (child.is_anomaly) {
                config[item.entity_type].aggregate_anomaly = true;
              } else {
                config[item.entity_type].aggregate_keys.push(child.aggreate_key);
              }
            }
            return {
              ...child,
              checked
            };
          })
        };
      });
      aggregateConfig.value = config;
    };
    const handleUpdateAutoAggregate = (v: boolean) => {
      autoAggregate.value = v;
      checkedIds.value = [];
      setTreeDataChecked();
      updateAggregationConfig();
    };
    const handleUpdateCheckedIds = (v: string[]) => {
      checkedIds.value = v;
      autoAggregate.value = false;
      setTreeDataChecked();
      updateAggregationConfig();
    };
    const getAggregationConfigValue = () => {
      if (autoAggregate.value || !checkedIds.value.length) {
        return {
          auto_aggregate: autoAggregate.value
        };
      }
      return {
        auto_aggregate: false,
        aggregate_config: aggregateConfig.value
      };
    };
    const updateAggregationConfig = () => {
      emit('update:AggregationConfig', getAggregationConfigValue());
    };
    const exitFullscreen = () => {
      if (!document.fullscreenElement) {
        isFullscreen.value = false;
      }
    };
    const handleFullscreen = () => {
      if (isFullscreen.value) {
        fullscreenHelper.exitFullscreen();
        isFullscreen.value = false;
      } else {
        fullscreenHelper.requestFullscreen(document.querySelector('.failure-topo'));
        isFullscreen.value = true;
      }
    };
    onMounted(() => {
      fullscreenHelper.onFullscreenChange(exitFullscreen);
    });
    return {
      isFullscreen,
      treeData,
      checkedIds,
      autoAggregate,
      handleFullscreen,
      handleUpdateAutoAggregate,
      handleUpdateCheckedIds
    };
  },
  render() {
    return (
      <div class='topo-tools'>
        {this.$t('故障拓扑')}
        <AggregationSelect
          class='topo-tools-agg'
          treeData={this.treeData}
          checkedIds={this.checkedIds}
          autoAggregate={this.autoAggregate}
          onUpdate:autoAggregate={this.handleUpdateAutoAggregate}
          onUpdate:checkedIds={this.handleUpdateCheckedIds}
        />
        <div
          class='topo-tools-list'
          v-bk-tooltips={{ content: this.$t('全屏'), disabled: this.isFullscreen }}
          onClick={this.handleFullscreen}
        >
          <span class='fullscreen'>
            <i class={['icon-monitor', !this.isFullscreen ? 'icon-zhankai1' : 'icon-shouqi1']}></i>
          </span>
        </div>
      </div>
    );
  }
});
