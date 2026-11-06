export const defaultCustomerGroupsTree = [
  {
    key: '0',
    label: '所有分组',
    data: '所有分组',
    icon: 'pi pi-folder-open',
    expanded: true,
    children: [
      {
        key: 'region-north',
        label: '华北地区',
        data: '华北地区',
        icon: 'pi pi-folder',
        expanded: true,
        children: [
          { key: 'north-tianjin', label: '天津', data: '天津', icon: 'pi pi-folder', children: [] },
          { key: 'north-beijing', label: '北京', data: '北京', icon: 'pi pi-folder', children: [] },
        ]
      },
      {
        key: 'region-south',
        label: '华南地区',
        data: '华南地区',
        icon: 'pi pi-folder',
        expanded: true,
        children: [
          { key: 'south-guangdong', label: '广东', data: '广东', icon: 'pi pi-folder', children: [] },
        ]
      },
      { key: 'region-northwest', label: '西北地区', data: '西北地区', icon: 'pi pi-folder', children: [] },
      { key: 'region-guangxi', label: '广西', data: '广西', icon: 'pi pi-folder', children: [] },
      { key: 'region-yunnan', label: '云南', data: '云南', icon: 'pi pi-folder', children: [] },
      {
        key: 'region-east',
        label: '华东地区',
        data: '华东地区',
        icon: 'pi pi-folder',
        expanded: true,
        children: [
          { key: 'east-jiangsu', label: '江苏', data: '江苏', icon: 'pi pi-folder', children: [] },
          { key: 'east-zhejiang', label: '浙江', data: '浙江', icon: 'pi pi-folder', children: [] },
          { key: 'east-shanghai', label: '上海', data: '上海', icon: 'pi pi-folder', children: [] },
        ]
      },
    ]
  }
]
