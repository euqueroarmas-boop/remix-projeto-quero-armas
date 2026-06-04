<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>

<!-- Sitemap Index template -->
<xsl:template match="sitemap:sitemapindex">
<html>
<head>
<title>Sitemap Index — WMTi</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;background:#111;color:#eee}
h1{font-size:1.4rem;margin-bottom:1rem}
a{color:#4fc3f7;text-decoration:none}
a:hover{text-decoration:underline}
table{width:100%;border-collapse:collapse;margin-top:1rem}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #222;font-size:13px}
th{color:#888;font-size:12px;text-transform:uppercase}
td.url{word-break:break-all}
.count{color:#888;font-size:.9rem}
</style>
</head>
<body>
<h1>Sitemap Index — WMTi <span class="count">
  (<xsl:value-of select="count(sitemap:sitemap)"/> sitemaps)
</span></h1>
<table>
<tr><th>Sitemap</th><th>Última atualização</th></tr>
<xsl:for-each select="sitemap:sitemap">
<tr>
  <td class="url"><a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a></td>
  <td><xsl:value-of select="sitemap:lastmod"/></td>
</tr>
</xsl:for-each>
</table>
</body>
</html>
</xsl:template>

<!-- URL set template -->
<xsl:template match="sitemap:urlset">
<html>
<head>
<title>Sitemap — WMTi</title>
<style>
body{font-family:system-ui,sans-serif;margin:2rem;background:#111;color:#eee}
h1{font-size:1.4rem;margin-bottom:1rem}
a{color:#4fc3f7;text-decoration:none}
a:hover{text-decoration:underline}
ul{list-style:none;padding:0;margin:0}
li{padding:4px 0;border-bottom:1px solid #222;font-size:13px;word-break:break-all}
.count{color:#888;font-size:.9rem}
</style>
</head>
<body>
<h1>Sitemap WMTi <span class="count">
  (<xsl:value-of select="count(sitemap:url)"/> URLs)
</span></h1>
<ul>
<xsl:for-each select="sitemap:url">
  <li><a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a></li>
</xsl:for-each>
</ul>
</body>
</html>
</xsl:template>

</xsl:stylesheet>