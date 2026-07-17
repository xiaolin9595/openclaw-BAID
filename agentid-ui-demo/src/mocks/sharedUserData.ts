// 共享用户数据源
// 统一管理用户信息，确保在Agent配置和个人中心页面数据一致性

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  department: string;
  position?: string;
  avatar?: string;
  joinDate?: string;
  location?: string;
  status: 'active' | 'inactive' | 'pending';
}

// 初始用户数据 - 基于个人中心的数据结构
export let sharedUsers: UserProfile[] = [
  {
    id: 'user_001',
    name: '张三',
    email: 'zhangsan@example.com',
    phone: '+86 138 0000 0000',
    department: '技术部',
    position: '高级工程师',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    joinDate: '2024-01-15',
    location: '北京市朝阳区',
    status: 'active'
  },
  {
    id: 'user_002',
    name: '李四',
    email: 'lisi@example.com',
    phone: '+86 138 0000 0001',
    department: '产品部',
    position: '产品经理',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisi',
    joinDate: '2024-02-01',
    location: '北京市海淀区',
    status: 'active'
  },
  {
    id: 'user_003',
    name: '王五',
    email: 'wangwu@example.com',
    phone: '+86 138 0000 0002',
    department: '设计部',
    position: 'UI设计师',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wangwu',
    joinDate: '2024-02-15',
    location: '北京市西城区',
    status: 'active'
  },
  {
    id: 'user_004',
    name: '赵六',
    email: 'zhaoliu@example.com',
    phone: '+86 138 0000 0003',
    department: '运营部',
    position: '运营专员',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhaoliu',
    joinDate: '2024-03-01',
    location: '北京市东城区',
    status: 'active'
  },
  {
    id: 'user_005',
    name: '钱七',
    email: 'qianqi@example.com',
    phone: '+86 138 0000 0004',
    department: '市场部',
    position: '市场经理',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Qianqi',
    joinDate: '2024-03-15',
    location: '北京市丰台区',
    status: 'pending'
  }
];

// 共享用户数据管理
export const sharedUserData = {
  // 获取所有用户
  getUsers: () => sharedUsers,

  // 根据ID获取用户
  getUserById: (id: string) => sharedUsers.find(user => user.id === id),

  // 根据邮箱获取用户
  getUserByEmail: (email: string) => sharedUsers.find(user => user.email === email),

  // 添加新用户
  addUser: (user: Omit<UserProfile, 'id'>) => {
    const newUser: UserProfile = {
      ...user,
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    sharedUsers = [newUser, ...sharedUsers];
    return newUser;
  },

  // 更新用户信息
  updateUser: (id: string, updates: Partial<UserProfile>) => {
    sharedUsers = sharedUsers.map(user =>
      user.id === id ? { ...user, ...updates } : user
    );
    return sharedUsers.find(user => user.id === id);
  },

  // 删除用户
  deleteUser: (id: string) => {
    sharedUsers = sharedUsers.filter(user => user.id !== id);
  },

  // 获取活跃用户
  getActiveUsers: () => sharedUsers.filter(user => user.status === 'active'),

  // 按部门筛选用户
  getUsersByDepartment: (department: string) => sharedUsers.filter(user => user.department === department),

  // 重置到初始数据
  reset: () => {
    sharedUsers = [
      {
        id: 'user_001',
        name: '张三',
        email: 'zhangsan@example.com',
        phone: '+86 138 0000 0000',
        department: '技术部',
        position: '高级工程师',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
        joinDate: '2024-01-15',
        location: '北京市朝阳区',
        status: 'active'
      },
      {
        id: 'user_002',
        name: '李四',
        email: 'lisi@example.com',
        phone: '+86 138 0000 0001',
        department: '产品部',
        position: '产品经理',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lisi',
        joinDate: '2024-02-01',
        location: '北京市海淀区',
        status: 'active'
      },
      {
        id: 'user_003',
        name: '王五',
        email: 'wangwu@example.com',
        phone: '+86 138 0000 0002',
        department: '设计部',
        position: 'UI设计师',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wangwu',
        joinDate: '2024-02-15',
        location: '北京市西城区',
        status: 'active'
      },
      {
        id: 'user_004',
        name: '赵六',
        email: 'zhaoliu@example.com',
        phone: '+86 138 0000 0003',
        department: '运营部',
        position: '运营专员',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zhaoliu',
        joinDate: '2024-03-01',
        location: '北京市东城区',
        status: 'active'
      },
      {
        id: 'user_005',
        name: '钱七',
        email: 'qianqi@example.com',
        phone: '+86 138 0000 0004',
        department: '市场部',
        position: '市场经理',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Qianqi',
        joinDate: '2024-03-15',
        location: '北京市丰台区',
        status: 'pending'
      }
    ];
  }
};

// 兼容性别名 - 保持向后兼容
export const MOCK_USERS = sharedUsers.map(user => ({
  id: user.id,
  name: user.name,
  email: user.email,
  department: user.department
}));

// 默认当前用户 - 用于个人中心显示
export const getCurrentUser = () => sharedUserData.getUserById('user_001');