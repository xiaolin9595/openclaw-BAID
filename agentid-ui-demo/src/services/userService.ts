import { User } from '../types';

// 模拟用户数据库（使用localStorage）
const USERS_STORAGE_KEY = 'agentid_users_db';

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface LoginData {
  username: string;
  password: string;
}

// 获取所有用户
const getAllUsers = (): Array<RegisterData & { id: string; userId: string; createdAt: string }> => {
  try {
    const usersStr = localStorage.getItem(USERS_STORAGE_KEY);
    return usersStr ? JSON.parse(usersStr) : [];
  } catch {
    return [];
  }
};

// 保存所有用户
const saveAllUsers = (users: Array<RegisterData & { id: string; userId: string; createdAt: string }>) => {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (error) {
    console.error('Failed to save users:', error);
  }
};

/**
 * 用户注册
 */
export const registerUser = async (data: RegisterData): Promise<User> => {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 1000));

  const users = getAllUsers();

  // 创建新用户
  const userId = `user_${Date.now()}`;
  const newUserData = {
    id: userId,
    userId,
    username: data.username,
    email: data.email,
    password: data.password, // 实际应用中应该加密
    createdAt: new Date().toISOString()
  };

  // 保存到"数据库"
  users.push(newUserData);
  saveAllUsers(users);

  // 返回用户对象（不包含密码）
  const user: User = {
    id: userId,
    userId,
    username: data.username,
    email: data.email,
    publicKey: `0x${Math.random().toString(16).substr(2, 40)}`,
    biometricStatus: 'bound',
    status: 'active',
    createdAt: newUserData.createdAt,
    authCount: 0
  };

  return user;
};

/**
 * 用户登录
 */
export const loginUser = async (data: LoginData): Promise<User> => {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 1000));

  const users = getAllUsers();

  // 查找用户
  const userRecord = users.find(u => u.username === data.username);

  if (!userRecord) {
    throw new Error('用户名不存在');
  }

  // 验证密码
  if (userRecord.password !== data.password) {
    throw new Error('密码错误');
  }

  // 返回用户对象（不包含密码）
  const user: User = {
    id: userRecord.id,
    userId: userRecord.userId,
    username: userRecord.username,
    email: userRecord.email,
    publicKey: `0x${Math.random().toString(16).substr(2, 40)}`,
    biometricStatus: 'bound',
    status: 'active',
    createdAt: userRecord.createdAt,
    authCount: 0
  };

  return user;
};

/**
 * 检查用户名是否可用
 */
export const checkUsernameAvailable = (username: string): boolean => {
  const users = getAllUsers();
  return !users.some(u => u.username === username);
};

/**
 * 检查邮箱是否可用
 */
export const checkEmailAvailable = (email: string): boolean => {
  const users = getAllUsers();
  return !users.some(u => u.email === email);
};
