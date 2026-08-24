/** 省市区静态数据（演示用精简版） */
export type Region = { name: string; cities: { name: string; districts: string[] }[] };

export const REGIONS: Region[] = [
  {
    name: '广东省',
    cities: [
      { name: '深圳市', districts: ['南山区', '福田区', '罗湖区', '宝安区', '龙岗区'] },
      { name: '广州市', districts: ['天河区', '越秀区', '海珠区', '白云区', '番禺区'] },
      { name: '东莞市', districts: ['南城街道', '东城街道', '长安镇', '松山湖'] },
    ],
  },
  {
    name: '北京市',
    cities: [
      { name: '北京市', districts: ['朝阳区', '海淀区', '东城区', '西城区', '丰台区', '昌平区'] },
    ],
  },
  {
    name: '上海市',
    cities: [
      { name: '上海市', districts: ['浦东新区', '徐汇区', '静安区', '黄浦区', '闵行区', '杨浦区'] },
    ],
  },
  {
    name: '浙江省',
    cities: [
      { name: '杭州市', districts: ['西湖区', '滨江区', '余杭区', '拱墅区', '萧山区'] },
      { name: '宁波市', districts: ['鄞州区', '海曙区', '江北区'] },
    ],
  },
  {
    name: '江苏省',
    cities: [
      { name: '南京市', districts: ['玄武区', '鼓楼区', '建邺区', '雨花台区'] },
      { name: '苏州市', districts: ['姑苏区', '工业园区', '吴中区', '相城区'] },
    ],
  },
  {
    name: '四川省',
    cities: [
      { name: '成都市', districts: ['武侯区', '锦江区', '青羊区', '高新区', '双流区'] },
      { name: '绵阳市', districts: ['涪城区', '游仙区'] },
    ],
  },
  {
    name: '湖北省',
    cities: [
      { name: '武汉市', districts: ['武昌区', '洪山区', '江汉区', '汉阳区', '东湖高新区'] },
      { name: '宜昌市', districts: ['西陵区', '伍家岗区'] },
    ],
  },
  {
    name: '陕西省',
    cities: [
      { name: '西安市', districts: ['雁塔区', '碑林区', '未央区', '高新区'] },
      { name: '咸阳市', districts: ['秦都区', '渭城区'] },
    ],
  },
];
