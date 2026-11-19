param(
  [Parameter(Mandatory=$true)][string]$Primary,
  [Parameter(Mandatory=$true)][string]$Secondary
)
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Read-ZipText($zip,$name){$entry=$zip.GetEntry($name);if(-not$entry){return $null};$reader=[IO.StreamReader]::new($entry.Open());try{$reader.ReadToEnd()}finally{$reader.Dispose()}}
function Read-SheetRows($path,$sheetName){
  $zip=[IO.Compression.ZipFile]::OpenRead($path);try{
    $workbook=[xml](Read-ZipText $zip 'xl/workbook.xml');$rels=[xml](Read-ZipText $zip 'xl/_rels/workbook.xml.rels');
    $ns=[Xml.XmlNamespaceManager]::new($workbook.NameTable);$ns.AddNamespace('m','http://schemas.openxmlformats.org/spreadsheetml/2006/main');
    $relationshipMap=@{};foreach($rel in $rels.Relationships.Relationship){$relationshipMap[[string]$rel.Id]=[string]$rel.Target}
    $shared=@();$sharedXml=Read-ZipText $zip 'xl/sharedStrings.xml';if($sharedXml){$sst=[xml]$sharedXml;$sn=[Xml.XmlNamespaceManager]::new($sst.NameTable);$sn.AddNamespace('m','http://schemas.openxmlformats.org/spreadsheetml/2006/main');foreach($si in $sst.SelectNodes('//m:si',$sn)){$shared+=(($si.SelectNodes('.//m:t',$sn)|ForEach-Object{$_.InnerText})-join '')}}
    $sheet=$workbook.SelectSingleNode("//m:sheets/m:sheet[@name='$sheetName']",$ns);if(-not$sheet){return @()};$rid=$sheet.Attributes.GetNamedItem('r:id').Value;$target=$relationshipMap[$rid];if($target -notlike 'xl/*'){$target='xl/'+$target.TrimStart('/')};$xml=[xml](Read-ZipText $zip $target);$xn=[Xml.XmlNamespaceManager]::new($xml.NameTable);$xn.AddNamespace('m','http://schemas.openxmlformats.org/spreadsheetml/2006/main');
    $result=@();foreach($row in $xml.SelectNodes('//m:sheetData/m:row',$xn)){$cells=@{};foreach($cell in $row.SelectNodes('./m:c',$xn)){$valueNode=$cell.SelectSingleNode('./m:v',$xn);$value=if($valueNode){$valueNode.InnerText}else{''};if($cell.t -eq 's' -and $value -match '^\d+$'){$value=$shared[[int]$value]};if($cell.t -eq 'inlineStr'){$value=(($cell.SelectNodes('.//m:t',$xn)|ForEach-Object{$_.InnerText})-join '')};$formula=$cell.SelectSingleNode('./m:f',$xn);$cells[[string]$cell.r]=[pscustomobject]@{value=$value;formula=if($formula){$formula.InnerText}else{''}}};$result+=,[pscustomobject]@{row=[int]$row.r;hidden=([string]$row.hidden -eq '1');cells=$cells}};return @($result)
  }finally{$zip.Dispose()}
}
function Get-Cell($row,$col){$cell=$row.cells[($col+$row.row)];if($cell){return $cell.value};return ''}
$workRows=Read-SheetRows $Primary 'Перечень_работ';$records=@();foreach($row in $workRows){$no=Get-Cell $row 'A';if($no -notmatch '^\d+(\.0+)?$'){continue};$records+=[pscustomobject]@{row=$row.row;hidden=$row.hidden;no=[int][double]$no;name=(Get-Cell $row 'D').Trim();unit=(Get-Cell $row 'E').Trim();price=Get-Cell $row 'F';note=Get-Cell $row 'G';h=Get-Cell $row 'H';i=Get-Cell $row 'I';j=Get-Cell $row 'J';k=Get-Cell $row 'K';l=Get-Cell $row 'L';category=(Get-Cell $row 'B').Trim();workType=(Get-Cell $row 'C').Trim();priceFormula=$row.cells[('F'+$row.row)].formula}};
$secondarySheets=@();$zip=[IO.Compression.ZipFile]::OpenRead($Secondary);try{$workbook=[xml](Read-ZipText $zip 'xl/workbook.xml');$ns=[Xml.XmlNamespaceManager]::new($workbook.NameTable);$ns.AddNamespace('m','http://schemas.openxmlformats.org/spreadsheetml/2006/main');foreach($sheet in $workbook.SelectNodes('//m:sheets/m:sheet',$ns)){$secondarySheets+=[string]$sheet.name}}finally{$zip.Dispose()}
[pscustomobject]@{records=$records;secondarySheets=$secondarySheets}|ConvertTo-Json -Depth 8 -Compress
