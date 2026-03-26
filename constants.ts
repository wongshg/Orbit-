import { Template, TaskStatus } from './types';

// Helper to generate IDs
const uuid = () => Math.random().toString(36).substr(2, 9);

export const SPV_DEREGISTRATION_TEMPLATE: Template = {
  id: 'spv_dereg_simple',
  name: '外资SPV简易注销流程',
  description: '适用于无债权债务、材料齐全的外资SPV公司注销。',
  stages: [
    {
      id: uuid(),
      title: '一、内部决策与批复',
      tasks: [
        {
          id: uuid(),
          title: '编制注销方案',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '注销方案草案', isReady: false }
          ]
        },
        {
          id: uuid(),
          title: '报局战发部上会审议',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: []
        },
        {
          id: uuid(),
          title: '香港航通发起注销请示',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '香港航通董事会决议', isReady: false }
          ]
        },
        {
          id: uuid(),
          title: '获取局战发部批复',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: []
        }
      ]
    },
    {
      id: uuid(),
      title: '二、注销准备与公示',
      tasks: [
        {
          id: uuid(),
          title: '签署《全体投资人承诺书》',
          description: '确保可办理税务注销，需股东盖章',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '全体投资人承诺书', isReady: false }
          ]
        },
        {
          id: uuid(),
          title: '发布简易注销公示',
          description: '国家企业信用信息公示系统，公示期20天',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '公示截图', isReady: false }
          ]
        }
      ]
    },
    {
      id: uuid(),
      title: '三、税务与社保清理',
      tasks: [
        {
          id: uuid(),
          title: '办理税务注销',
          description: '建议在公示期间并行推进',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '清税证明', isReady: false },
            { id: uuid(), name: '最近年度审计报告', isReady: false }
          ]
        },
        {
          id: uuid(),
          title: '办理社保注销',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: []
        }
      ]
    },
    {
      id: uuid(),
      title: '四、工商与产权注销',
      tasks: [
        {
          id: uuid(),
          title: '办理工商注销登记',
          description: '公示期满后20天内办理',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '登记（备案）申请书', isReady: false },
            { id: uuid(), name: '营业执照正副本', isReady: false },
            { id: uuid(), name: '清税证明', isReady: false },
            { id: uuid(), name: '准予注销通知书（办理后领取）', isReady: false }
          ]
        },
        {
          id: uuid(),
          title: '提交注销产权登记',
          description: '工商注销完成后进行',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '准予注销通知书', isReady: false },
            { id: uuid(), name: '注销方案', isReady: false },
            { id: uuid(), name: '法律意见书', isReady: false }
          ]
        },
        {
          id: uuid(),
          title: '银行账户注销',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '银行账户注销证明', isReady: false }
          ]
        }
      ]
    }
  ]
};

export const PROJECT_CO_DEREGISTRATION_TEMPLATE: Template = {
  id: 'project_co_dereg_normal',
  name: '控股项目公司普通注销',
  description: '适用于一般控股项目公司的普通注销流程（含清算组）。',
  stages: [
    {
      id: uuid(),
      title: '一、内部决策',
      tasks: [
        {
          id: uuid(),
          title: '编制清算注销方案',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '清算注销方案汇报材料', isReady: false }
          ]
        },
        {
          id: uuid(),
          title: '股东会决议',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '公司注销股东会决议文件', isReady: false },
            { id: uuid(), name: '三航局总办会决议', isReady: false }
          ]
        }
      ]
    },
    {
      id: uuid(),
      title: '二、清算组与公告',
      tasks: [
        {
          id: uuid(),
          title: '成立清算组备案',
          description: '股东决议15日内成立，10日内公示',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '清算组成员名单', isReady: false }
          ]
        },
        {
          id: uuid(),
          title: '发布债权人公告',
          description: '公告期45天',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: []
        }
      ]
    },
    {
      id: uuid(),
      title: '三、清算实施',
      tasks: [
        {
          id: uuid(),
          title: '清理财产与编制报表',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '资产负债表', isReady: false },
            { id: uuid(), name: '财产清单', isReady: false }
          ]
        },
        {
          id: uuid(),
          title: '税务注销',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '清税证明', isReady: false }
          ]
        },
        {
          id: uuid(),
          title: '出具清算报告',
          description: '需报股东会审批',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '清算报告', isReady: false }
          ]
        }
      ]
    },
    {
      id: uuid(),
      title: '四、注销登记',
      tasks: [
        {
          id: uuid(),
          title: '工商注销登记',
          status: TaskStatus.PENDING,
          statusNote: '',
          lastUpdated: Date.now(),
          materials: [
            { id: uuid(), name: '公司注销登记申请书', isReady: false },
            { id: uuid(), name: '股东会决议', isReady: false },
            { id: uuid(), name: '清算报告', isReady: false }
          ]
        }
      ]
    }
  ]
};

export const ALL_TEMPLATES = [SPV_DEREGISTRATION_TEMPLATE, PROJECT_CO_DEREGISTRATION_TEMPLATE];
