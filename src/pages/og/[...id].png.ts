import { published, formatDate } from '../../lib/articles';
import { renderOG } from '../../lib/og';
export async function getStaticPaths() {
  return [{params:{id:'index'}, props:{ title:'Записи', description:'Практические статьи о Home Assistant, AI-ботах, автомобилях и электронике.', tags:[], date:'' }},
    ...(await published()).map(a => ({params:{id:a.id}, props:{ title:a.data.title, description:a.data.description, tags:a.data.tags, date:formatDate(a.data.updated || a.data.date) }}))];
}
export function GET({props}: any) {
  return new Response(renderOG(props.title, props.description, props.tags, props.date), {headers:{'Content-Type':'image/png'}});
}
