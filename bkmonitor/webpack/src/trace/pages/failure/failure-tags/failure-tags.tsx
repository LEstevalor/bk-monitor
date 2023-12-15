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
import { computed, defineComponent, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Tag } from 'bkui-vue';

// import TagShow from './tag-show';
import './failure-tags.scss';

export default defineComponent({
  props: {
    incidentDetail: {
      type: Object,
      default: () => {}
    }
  },
  emits: ['collapse'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const isShow = ref<boolean>(false);
    const failureTags = ref();
    const incidentDetailData = computed(() => {
      console.log(props.incidentDetail, 'props.incidentDetail');
      return props.incidentDetail;
    });
    const renderList = [
      {
        label: t('影响业务'),
        renderFn: () => {
          const snapshots = incidentDetailData.value.current_snapshot?.bk_biz_ids || [];
          return snapshots.length === 0 ? (
            <span class='empty-text'>--</span>
          ) : (
            snapshots.map(item => <Tag ext-cls='business-tag'>{`[${item.bk_biz_id}] ${item.bk_biz_name}`}</Tag>)
          );
        }
      },
      {
        label: t('故障根因'),
        renderFn: () => {
          const snapshots = incidentDetailData.value.snapshots || [];
          return (
            <span class='item-info'>
              {snapshots[0]?.content?.incident_name || '--'}
              {/* Service ( <label class='name-target'>我是名称占位</label> ) 于 <b>2023-08-12 00:00:00 </b>
              发生异常，导致 141 个告警 */}
            </span>
          );
        }
      },
      {
        label: t('故障负责人'),
        renderFn: () => {
          const list = incidentDetailData.value?.assignees || [];
          // if (!isShow.value) {
          //   return (
          //     <TagShow
          //       styleName={'principal-tag'}
          //       data={principal}
          //     />
          //   );
          // }
          return list.length === 0 ? (
            <span class='empty-text'>--</span>
          ) : (
            list.map(item => <Tag ext-cls='principal-tag'>{item}</Tag>)
          );
        }
      }
    ];
    const expandCollapseHandle = () => {
      isShow.value = !isShow.value;
      nextTick(() => {
        emit('collapse', isShow.value, failureTags?.value?.clientHeight);
      });
    };
    return { renderList, expandCollapseHandle, isShow, failureTags, incidentDetailData };
  },
  render() {
    // const { assignees = [], handlers = [] } = this.incidentDetailData;
    return (
      <div
        ref='failureTags'
        class={['failure-tags', { 'failure-tags-full': this.isShow }]}
      >
        {this.renderList.map(item => (
          <div class='failure-tags-item'>
            <span class='item-label'>{item.label}：</span>
            <div class='item-main'>{item.renderFn()}</div>
          </div>
        ))}
        {/* <i
          class={`icon-monitor icon-double-${this.isShow ? 'up' : 'down'} failure-tags-icon`}
          onClick={this.expandCollapseHandle}
        ></i> */}
      </div>
    );
  }
});
