import {
  CredentialData,
  GeneratedIdentity,
  IdentityGenerationConfig,
  GenerationStep,
  GenerationProcess,
  IdentityMetadata,
  IdentityValidation
} from '../../types/identity';
import { v4 as uuidv4 } from 'uuid';
import { sha256 } from 'js-sha256';

export class IdentityGenerator {
  private config: IdentityGenerationConfig;
  private process: GenerationProcess | null = null;
  private stepCallbacks: ((step: GenerationStep) => void)[] = [];
  private progressCallbacks: ((progress: number) => void)[] = [];

  constructor(config: Partial<IdentityGenerationConfig> = {}) {
    this.config = {
      prefix: 'AGT',
      useUUID: true,
      includeHash: true,
      hashAlgorithm: 'sha256',
      confidenceThreshold: 0.7,
      enableSteps: true,
      generateMultiple: false,
      count: 1,
      ...config
    };
  }

  // 模拟OCR数据提取
  async extractCredentialData(file: File): Promise<CredentialData> {
    const step: GenerationStep = {
      id: uuidv4(),
      name: '数据提取',
      status: 'in_progress',
      description: '从上传的凭证文件中提取身份信息',
      progress: 0,
      startTime: new Date().toISOString()
    };

    this.notifyStepUpdate(step);

    try {
      // 模拟OCR处理时间
      await this.simulateProcessing(1000, 3000, (progress) => {
        step.progress = progress;
        this.notifyStepUpdate(step);
      });

      // 模拟提取的凭证数据
      const mockData: CredentialData = {
        id: uuidv4(),
        type: this.inferCredentialType(file.name),
        name: this.generateMockName(),
        documentNumber: this.generateMockDocumentNumber(),
        issuingCountry: 'CN',
        issuedDate: this.generateMockDate(-365 * 5)!, // 5年前
        expiryDate: this.generateMockDate(365 * 5)!, // 5年后
        dateOfBirth: this.generateMockDate(-365 * 25)!, // 25年前
        nationality: '中国',
        gender: Math.random() > 0.5 ? 'male' : 'female',
        address: this.generateMockAddress(),
        confidence: 0.85 + Math.random() * 0.1, // 85-95%
        extractedAt: new Date().toISOString()
      };

      step.status = 'completed';
      step.progress = 100;
      step.endTime = new Date().toISOString();
      step.duration = step.startTime ? Date.now() - new Date(step.startTime).getTime() : 0;
      step.output = mockData;

      this.notifyStepUpdate(step);

      return mockData;
    } catch (error) {
      step.status = 'failed';
      step.endTime = new Date().toISOString();
      step.error = error instanceof Error ? error.message : '数据提取失败';
      this.notifyStepUpdate(step);
      throw error;
    }
  }

  // 生成身份标识
  async generateIdentity(credentialData: CredentialData): Promise<GeneratedIdentity> {
    const steps: GenerationStep[] = [];
    const startTime = Date.now();

    // 步骤1: 数据验证
    const validationStep = await this.validateCredentialData(credentialData);
    steps.push(validationStep);

    // 步骤2: 生成UUID
    const uuidStep = await this.generateUUID();
    steps.push(uuidStep);

    // 步骤3: 生成哈希
    const hashStep = await this.generateHash(credentialData);
    steps.push(hashStep);

    // 步骤4: 计算置信度
    const confidenceStep = await this.calculateConfidence(credentialData, steps);
    steps.push(confidenceStep);

    // 步骤5: 构建身份标识
    const buildStep = await this.buildIdentity(credentialData, uuidStep.output, hashStep.output, confidenceStep.output);
    steps.push(buildStep);

    const processingTime = Date.now() - startTime;

    const identity: GeneratedIdentity = {
      id: uuidv4(),
      identityId: buildStep.output.identityId,
      prefix: this.config.prefix,
      hash: buildStep.output.hash,
      confidence: confidenceStep.output,
      credentialData,
      generatedAt: new Date().toISOString(),
      steps,
      metadata: {
        algorithm: 'AgentID-v1.0',
        version: '1.0.0',
        processingTime,
        dataQuality: this.assessDataQuality(credentialData),
        validationStatus: validationStep.status === 'completed' ? 'passed' : 'failed'
      }
    };

    return identity;
  }

  // 启动生成过程
  async startGeneration(file: File): Promise<GenerationProcess> {
    this.process = {
      id: uuidv4(),
      credentialFile: file,
      config: this.config,
      status: 'processing',
      progress: 0,
      currentStep: 0,
      steps: this.initializeSteps(),
      startedAt: new Date().toISOString()
    };

    this.notifyProgress(0);

    try {
      // 步骤1: 提取凭证数据
      const credentialData = await this.extractCredentialData(file);
      this.process.currentStep = 1;
      this.notifyProgress(25);

      // 步骤2: 生成身份标识
      const identity = await this.generateIdentity(credentialData);
      this.process.currentStep = 2;
      this.notifyProgress(75);

      // 步骤3: 最终验证
      await this.finalValidation(identity);
      this.process.currentStep = 3;
      this.notifyProgress(100);

      this.process.status = 'completed';
      this.process.result = identity;
      this.process.completedAt = new Date().toISOString();

      return this.process;
    } catch (error) {
      this.process.status = 'failed';
      this.process.error = error instanceof Error ? error.message : '生成失败';
      this.process.completedAt = new Date().toISOString();
      throw error;
    }
  }

  // 数据验证
  private async validateCredentialData(data: CredentialData): Promise<GenerationStep> {
    const step: GenerationStep = {
      id: uuidv4(),
      name: '数据验证',
      status: 'in_progress',
      description: '验证提取的凭证数据完整性',
      progress: 0,
      startTime: new Date().toISOString()
    };

    this.notifyStepUpdate(step);

    await this.simulateProcessing(500, 1000, (progress) => {
      step.progress = progress;
      this.notifyStepUpdate(step);
    });

    const validation = this.performValidation(data);

    step.status = validation.isValid ? 'completed' : 'failed';
    step.progress = 100;
    step.endTime = new Date().toISOString();
    step.duration = step.startTime ? Date.now() - new Date(step.startTime).getTime() : 0;
    step.output = validation;

    if (!validation.isValid) {
      step.error = '数据验证失败';
    }

    this.notifyStepUpdate(step);
    return step;
  }

  // 生成UUID
  private async generateUUID(): Promise<GenerationStep> {
    const step: GenerationStep = {
      id: uuidv4(),
      name: '生成UUID',
      status: 'in_progress',
      description: '生成唯一标识符',
      progress: 0,
      startTime: new Date().toISOString()
    };

    this.notifyStepUpdate(step);

    await this.simulateProcessing(200, 500, (progress) => {
      step.progress = progress;
      this.notifyStepUpdate(step);
    });

    const uuid = uuidv4();

    step.status = 'completed';
    step.progress = 100;
    step.endTime = new Date().toISOString();
    step.duration = step.startTime ? Date.now() - new Date(step.startTime).getTime() : 0;
    step.output = uuid;

    this.notifyStepUpdate(step);
    return step;
  }

  // 生成哈希
  private async generateHash(data: CredentialData): Promise<GenerationStep> {
    const step: GenerationStep = {
      id: uuidv4(),
      name: '生成哈希',
      status: 'in_progress',
      description: `使用${this.config.hashAlgorithm}算法生成数据哈希`,
      progress: 0,
      startTime: new Date().toISOString()
    };

    this.notifyStepUpdate(step);

    await this.simulateProcessing(300, 800, (progress) => {
      step.progress = progress;
      this.notifyStepUpdate(step);
    });

    const dataString = JSON.stringify({
      name: data.name,
      documentNumber: data.documentNumber,
      dateOfBirth: data.dateOfBirth,
      nationality: data.nationality
    });

    let hash: string;
    switch (this.config.hashAlgorithm) {
      case 'sha256':
        hash = sha256(dataString);
        break;
      case 'sha512':
        hash = sha256(dataString + '512'); // 使用sha256模拟sha512
        break;
      default:
        hash = sha256(dataString);
    }

    step.status = 'completed';
    step.progress = 100;
    step.endTime = new Date().toISOString();
    step.duration = step.startTime ? Date.now() - new Date(step.startTime).getTime() : 0;
    step.output = hash;

    this.notifyStepUpdate(step);
    return step;
  }

  // 计算置信度
  private async calculateConfidence(data: CredentialData, steps: GenerationStep[]): Promise<GenerationStep> {
    const step: GenerationStep = {
      id: uuidv4(),
      name: '计算置信度',
      status: 'in_progress',
      description: '分析数据质量并计算生成置信度',
      progress: 0,
      startTime: new Date().toISOString()
    };

    this.notifyStepUpdate(step);

    await this.simulateProcessing(400, 900, (progress) => {
      step.progress = progress;
      this.notifyStepUpdate(step);
    });

    // 基于多个因素计算置信度
    const dataQuality = this.assessDataQuality(data);
    const stepSuccess = steps.filter(s => s.status === 'completed').length / steps.length;
    const extractionConfidence = data.confidence;

    let confidence = extractionConfidence * 0.6 + stepSuccess * 0.4;

    // 根据数据质量调整
    switch (dataQuality) {
      case 'high':
        confidence *= 1.0;
        break;
      case 'medium':
        confidence *= 0.9;
        break;
      case 'low':
        confidence *= 0.8;
        break;
    }

    confidence = Math.min(confidence, 0.99); // 最高99%

    step.status = 'completed';
    step.progress = 100;
    step.endTime = new Date().toISOString();
    step.duration = step.startTime ? Date.now() - new Date(step.startTime).getTime() : 0;
    step.output = confidence;

    this.notifyStepUpdate(step);
    return step;
  }

  // 构建身份标识
  private async buildIdentity(
    data: CredentialData,
    uuid: string,
    hash: string,
    confidence: number
  ): Promise<GenerationStep> {
    const step: GenerationStep = {
      id: uuidv4(),
      name: '构建身份标识',
      status: 'in_progress',
      description: '组合所有组件生成最终身份标识',
      progress: 0,
      startTime: new Date().toISOString()
    };

    this.notifyStepUpdate(step);

    await this.simulateProcessing(200, 600, (progress) => {
      step.progress = progress;
      this.notifyStepUpdate(step);
    });

    const identityId = this.config.useUUID
      ? `${this.config.prefix}-${uuid}`
      : `${this.config.prefix}-${hash.substring(0, 8)}`;

    step.status = 'completed';
    step.progress = 100;
    step.endTime = new Date().toISOString();
    step.duration = step.startTime ? Date.now() - new Date(step.startTime).getTime() : 0;
    step.output = { identityId, hash, confidence };

    this.notifyStepUpdate(step);
    return step;
  }

  // 最终验证
  private async finalValidation(identity: GeneratedIdentity): Promise<void> {
    // 验证身份标识的完整性
    if (!identity.identityId || !identity.hash || identity.confidence < this.config.confidenceThreshold) {
      throw new Error('身份标识生成失败：验证未通过');
    }
  }

  // 工具方法
  private inferCredentialType(filename: string): CredentialData['type'] {
    const lower = filename.toLowerCase();
    if (lower.includes('id') || lower.includes('身份证')) return 'id_card';
    if (lower.includes('passport') || lower.includes('护照')) return 'passport';
    if (lower.includes('license') || lower.includes('驾照')) return 'driver_license';
    return 'other';
  }

  private generateMockName(): string {
    const surnames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴'];
    const givenNames = ['伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军'];
    return surnames[Math.floor(Math.random() * surnames.length)] +
           givenNames[Math.floor(Math.random() * givenNames.length)];
  }

  private generateMockDocumentNumber(): string {
    return Math.random().toString(36).substring(2, 15).toUpperCase();
  }

  private generateMockDate(daysOffset: number): string | undefined {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  }

  private generateMockAddress(): string {
    const cities = ['北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉'];
    const districts = ['朝阳区', '海淀区', '浦东新区', '天河区', '西湖区', '鼓楼区'];
    return cities[Math.floor(Math.random() * cities.length)] +
           districts[Math.floor(Math.random() * districts.length)] +
           Math.floor(Math.random() * 999) + '号';
  }

  private assessDataQuality(data: CredentialData): 'high' | 'medium' | 'low' {
    let score = 0;

    // 检查必要字段
    if (data.name && data.documentNumber && data.dateOfBirth) score += 3;
    if (data.issuingCountry && data.nationality) score += 2;
    if (data.issuedDate && data.expiryDate) score += 2;
    if (data.address) score += 1;

    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }

  private performValidation(data: CredentialData): IdentityValidation {
    const errors: any[] = [];
    const warnings: any[] = [];

    // 检查必要字段
    if (!data.name) errors.push({ code: 'MISSING_NAME', message: '姓名缺失', field: 'name', severity: 'error' });
    if (!data.documentNumber) errors.push({ code: 'MISSING_DOCUMENT_NUMBER', message: '证件号码缺失', field: 'documentNumber', severity: 'error' });
    if (!data.dateOfBirth) errors.push({ code: 'MISSING_DOB', message: '出生日期缺失', field: 'dateOfBirth', severity: 'error' });

    // 检查日期合理性
    if (data.issuedDate && data.expiryDate) {
      const issued = new Date(data.issuedDate);
      const expiry = new Date(data.expiryDate);
      if (issued >= expiry) {
        warnings.push({ code: 'INVALID_DATE_RANGE', message: '发证日期晚于到期日期', field: 'dates' });
      }
    }

    return {
      isValid: errors.length === 0,
      confidence: Math.max(0.1, 1 - errors.length * 0.2),
      errors,
      warnings,
      suggestions: warnings.length > 0 ? ['请检查证件信息的准确性'] : []
    };
  }

  private initializeSteps(): GenerationStep[] {
    return [
      {
        id: uuidv4(),
        name: '数据提取',
        status: 'pending',
        description: '从上传的凭证文件中提取身份信息',
        progress: 0
      },
      {
        id: uuidv4(),
        name: '身份生成',
        status: 'pending',
        description: '基于提取的数据生成身份标识',
        progress: 0
      },
      {
        id: uuidv4(),
        name: '最终验证',
        status: 'pending',
        description: '验证生成结果的完整性和准确性',
        progress: 0
      }
    ];
  }

  private async simulateProcessing(
    minTime: number,
    maxTime: number,
    onProgress: (progress: number) => void
  ): Promise<void> {
    const duration = minTime + Math.random() * (maxTime - minTime);
    const steps = 20;
    const stepTime = duration / steps;

    for (let i = 0; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepTime));
      onProgress((i / steps) * 100);
    }
  }

  private notifyStepUpdate(step: GenerationStep): void {
    this.stepCallbacks.forEach(callback => callback(step));
  }

  private notifyProgress(progress: number): void {
    this.progressCallbacks.forEach(callback => callback(progress));
  }

  // 事件监听器
  onStepUpdate(callback: (step: GenerationStep) => void): void {
    this.stepCallbacks.push(callback);
  }

  onProgressUpdate(callback: (progress: number) => void): void {
    this.progressCallbacks.push(callback);
  }

  // 获取当前进程状态
  getCurrentProcess(): GenerationProcess | null {
    return this.process;
  }

  // 更新配置
  updateConfig(newConfig: Partial<IdentityGenerationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // 批量生成
  async generateMultiple(files: File[]): Promise<GeneratedIdentity[]> {
    const results: GeneratedIdentity[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const process = await this.startGeneration(files[i]);
        if (process.result) {
          results.push(process.result);
        }
      } catch (error) {
        console.error(`生成失败 ${files[i].name}:`, error);
      }
    }

    return results;
  }
}