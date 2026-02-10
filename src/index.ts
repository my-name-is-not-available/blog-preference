const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zecrimp 分流</title>
</head>
<body>
    <h1>Zecrimp 分流</h1>
    <h2>分流中</h2>
</body>
<script>
    const hosts = __HOSTS_PLACEHOLDER__;

    function sendHeadRequest(url) {
        const startTime = Date.now();
        return fetch(url, { 
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache'
        })
            .then(response => {
                const endTime = Date.now();
                return {
                    url: url,
                    status: response.status,
                    responseTime: endTime - startTime
                };
            })
            .catch(error => {
                throw new Error(\`请求\${url}失败: \${error.message}\`);
            });
    }

    async function checkHostAndRedirect() {
        const currentParams = new URLSearchParams(window.location.search);
        const paramsString = currentParams.toString();
        const suffix = paramsString ? '?' + paramsString : '';

        const urls = hosts;
        const requests = urls.map(url => sendHeadRequest(url));

        try {
            const result = await Promise.race(requests);
            console.log(\`最快响应的URL是: \${result.url}，响应时间: \${result.responseTime}ms\`);
            window.location.href = result.url + suffix;
        } catch (error) {
            console.error('所有请求均失败:', error);
            document.querySelector('h2').textContent = '所有分流地址均不可用';
        }
    }

    checkHostAndRedirect();
</script>
</html>`;
const isFile = (url: string) => {
	try {
		const pathname = new URL(url).pathname;
		const segments = pathname.split('/').filter(Boolean);
		const lastSegment = segments[segments.length - 1];
		return lastSegment ? lastSegment.includes('.') : false;
	} catch {
		return false;
	}
}

const proxy = async (request: Request, origin: string) => {
	const parsedUrl = new URL(request.url);
			const targetUrl = `https://${origin}${parsedUrl.pathname}${parsedUrl.search}`;
			const response = await fetch(targetUrl, {
				headers: request.headers,
				method: request.method,
				body: request.body,
			});
			const headers = new Headers(response.headers);
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers,
			});
}
export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = request.url;
		if (isFile(url) || request.method !== 'GET') {
			return proxy(request, env.origin);
		} else {
			const parsedHosts = JSON.parse(env.hosts);
			const htmlWithHosts = html.replace('__HOSTS_PLACEHOLDER__', JSON.stringify(parsedHosts));
			return new Response(htmlWithHosts, {
				headers: {
					'Content-Type': 'text/html',
				},
			});
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
