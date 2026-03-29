<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
<xsl:output method="html" encoding="UTF-8" indent="yes"/>
<xsl:template match="/">
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
  (<xsl:value-of select="count(sitemap:urlset/sitemap:url)"/> URLs)
</span></h1>
<ul>
<xsl:for-each select="sitemap:urlset/sitemap:url">
  <li><a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a></li>
</xsl:for-each>
</ul>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
