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
import { defineComponent, ref, computed, inject, Ref, onMounted } from 'vue';
import { Select, Tag } from 'bkui-vue';
import FilterSearchInput from './filter-search-input';
import { useI18n, TranslateResult } from 'vue-i18n';
import { SPACE_TYPE_MAP } from '../../common/constant';
import './filter-search-main.scss';
export enum ETagsType {
  BKCC = 'bkcc' /** 业务 */,
  BCS = 'bcs' /** 容器项目 */,
  BKCI = 'bkci' /** 蓝盾项目 */,
  BKSAAS = 'bksaas' /** 蓝鲸应用 */,
  MONITOR = 'monitor' /** 监控空间 */
}
export type AnlyzeField =
  | 'alert_name'
  | 'metric'
  | 'duration'
  | 'ip'
  | 'bk_cloud_id'
  | 'strategy_id'
  | 'assignee'
  | 'bk_service_instance_id'
  | 'ipv6';
export interface ICommonItem {
  id: string;
  name: string | TranslateResult;
}
export default defineComponent({
  emits: ['search', 'changeSpace'],
  setup(props, { emit }) {
    const incidentDetail = inject<Ref<object>>('incidentDetail');
    const { t } = useI18n();
    const spaceFilter = ref<number[]>([]);
    const searchType = ref('alert');
    const queryString = ref('');
    const spaceData = ref(null);
    const filterInputStatus = 'success';
    const valueMap = ref<Record<Partial<AnlyzeField>, ICommonItem[]> | null>(null);
    const currentBizList = computed(() => {
      const { current_snapshot } = incidentDetail.value;
      return current_snapshot?.bk_biz_id || [];
    });
    const spaceDataList = computed(() => {
      const list = (window.space_list || []).filter(item => currentBizList.value.includes(item.bk_biz_id));
      return getSpaceList(list || []);
    });
    const changeSpace = (space: string) => {
      emit('changeSpace', space);
    };
    /* 整理space_list */
    const getSpaceList = (spaceList) => {
      const list = [];
      spaceList.forEach(item => {
        const tags = [{ id: item.space_type_id, name: item.type_name, type: item.space_type_id }];
        if (item.space_type_id === 'bkci' && item.space_code) {
          tags.push({ id: 'bcs', name: t('容器项目'), type: 'bcs' });
        }
        const newItem = {
          ...item,
          name: item.space_name.replace(/\[.*?\]/, ''),
          tags,
          isCheck: false,
          show: true
        };
        list.push(newItem);
      });
      return list;
    };
    /**
     * @description: 查询条件变更时触发搜索
     * @param {string} v 查询语句
     * @return {*}
     */
    const handleQueryStringChange = async (v: string) => {
      const isChange = v !== queryString.value;
      if (isChange) {
        queryString.value = v;
        emit('search', queryString.value);
      }
    };
    onMounted(() => {
      console.log(currentBizList.value, 'currentBizList')
    })
    return {
      t,
      handleQueryStringChange,
      spaceFilter,
      changeSpace,
      searchType,
      queryString,
      spaceData,
      filterInputStatus,
      valueMap,
      spaceDataList
    };
  },
  render() {
    console.log(this.spaceDataList, 'spaceDataLists');
    return (
      <div class='failure-search-main'>
        <div class='main-top'>
          <Select
            v-model={this.spaceFilter}
            filterable
            multiple
            inputSearch={false}
            class='main-select'
            selected-style='checkbox'
            prefix={this.t('空间筛选')}
            onChange={this.changeSpace}
          >
            {this.spaceDataList.map((item, ind) => (
              <Select.Option
                class='main-select-item'
                name={item.name}
                key={ind}
                id={item.id}
              >
                <span class='item-name'>
                  <span
                    class={['name', { disabled: !!item.noAuth && !item.hasData }]}
                    // v-bk-overflow-tips
                  >
                    {item.name}
                  </span>
                  {/* {!item?.isSpecial && (
                    <span class='id'>
                      ({item.space_type_id === ETagsType.BKCC ? `#${item.id}` : item.space_id || item.space_code})
                    </span>
                  )} */}
                </span>
                <div class='space-tags'>
                  {item.tags.map(tag =>
                    SPACE_TYPE_MAP[tag.id]?.name ? (
                      <Tag
                        class='space-tags-item'
                        style={{ ...SPACE_TYPE_MAP[tag.id]?.light }}
                      >
                        {SPACE_TYPE_MAP[tag.id]?.name}
                      </Tag>
                    ) : ''
                  )}
                </div>
              </Select.Option>
            ))}
          </Select>
        </div>
        <div class='main-bot'>
          <FilterSearchInput
            ref='filterInput'
            value={this.queryString}
            valueMap={this.valueMap}
            searchType={this.searchType}
            isFillId={true}
            inputStatus={this.filterInputStatus}
            onChange={this.handleQueryStringChange}
            onClear={this.handleQueryStringChange}
          />
        </div>
      </div>
    );
  }
});
