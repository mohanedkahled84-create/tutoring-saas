import {proxyTeacherQuiz} from './verifiedBackendProxy.js';
export default async function handler(req,res){return proxyTeacherQuiz(req,res,req.method==='POST'?'submissions/grade-essay':'submissions',['GET','POST']);}
