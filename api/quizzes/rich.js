import {proxyTeacherQuiz} from './verifiedBackendProxy.js';
export default async function handler(req,res){return proxyTeacherQuiz(req,res,'rich',['GET','POST']);}
