import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '../../../middleware';
const secret='payroll-security-test-secret-at-least-32-chars';
function request(path:string,role:string,exp=4102444800){
 const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const p=Buffer.from(JSON.stringify({sub:'TEST',role,exp})).toString('base64url');
 const s=createHmac('sha256',secret).update(`${h}.${p}`).digest('base64url');
 return new NextRequest(`https://hr.example${path}`,{headers:{cookie:`ykp_hr_session=${h}.${p}.${s}`}});
}
beforeEach(()=>vi.stubEnv('SESSION_SECRET',secret));afterEach(()=>vi.unstubAllEnvs());
describe('salary privacy boundary',()=>{
 it.each(['employee','supervisor','outlet_manager','brand_manager','hr_admin','super_admin','viewer'])('denies %s direct payroll/payslip pages and APIs',async role=>{
  for(const path of ['/hr/payroll','/hr/payroll/generate','/api/hr/payroll/unlock','/api/hr/payslip/PR1','/hr/audit','/hr/adjustments','/api/hr/adjustments','/api/hr/adjustments/approve']){
   const response=await middleware(request(path,role));expect(response.headers.get('x-middleware-next'),path).not.toBe('1');expect(response.status,path).toBe(403);
  }
 });
 it.each(['owner','finance_admin'])('permits %s payroll reads',async role=>{
  expect((await middleware(request('/hr/payroll',role))).headers.get('x-middleware-next')).toBe('1');
  expect((await middleware(request('/hr/adjustments',role))).headers.get('x-middleware-next')).toBe('1');
 });
 it('rejects expired signed sessions',async()=>{
  expect((await middleware(request('/api/hr/payroll/generate','owner',1))).status).toBe(401);
 });
});
