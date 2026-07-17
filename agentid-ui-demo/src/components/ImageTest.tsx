import React from 'react';
import testImage2 from '../assets/test-image-2.png';

const ImageTest: React.FC = () => {
  return (
    <div className="p-8 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">PNG图片测试</h2>

      <div className="space-y-6">
        {/* 测试public目录中的PNG */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">Public目录PNG测试</h3>
          <img
            src="/test-image.png"
            alt="Test PNG from public directory"
            className="border border-gray-300 rounded"
            style={{ maxWidth: '200px' }}
          />
          <p className="text-sm text-gray-600 mt-2">路径: /test-image.png</p>
        </div>

        {/* 测试src/assets目录中的PNG */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">Assets目录PNG测试</h3>
          <img
            src={testImage2}
            alt="Test PNG from assets directory"
            className="border border-gray-300 rounded"
            style={{ maxWidth: '200px' }}
          />
          <p className="text-sm text-gray-600 mt-2">路径: src/assets/test-image-2.png (通过import)</p>
        </div>

        {/* 测试在线PNG */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">在线PNG测试</h3>
          <img
            src="https://via.placeholder.com/200x100/007bff/ffffff?text=PNG+Test"
            alt="Online PNG test"
            className="border border-gray-300 rounded"
            style={{ maxWidth: '200px' }}
          />
          <p className="text-sm text-gray-600 mt-2">路径: 在线图片URL</p>
        </div>

        {/* 测试base64编码的PNG */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">Base64 PNG测试</h3>
          <img
            src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            alt="Base64 PNG test"
            className="border border-gray-300 rounded"
            style={{ maxWidth: '200px' }}
          />
          <p className="text-sm text-gray-600 mt-2">格式: Base64编码</p>
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded">
        <h3 className="font-semibold mb-2">测试说明:</h3>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>本页面测试PNG图片在不同位置和格式下的显示情况</li>
          <li>如果某个图片无法显示，说明该项目不支持该类型的图片加载</li>
          <li>检查浏览器控制台是否有相关错误信息</li>
          <li>public目录的图片可以通过绝对路径访问</li>
          <li>src/assets目录的图片需要通过import导入</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageTest;