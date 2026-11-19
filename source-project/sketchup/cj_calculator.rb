# encoding: UTF-8
require 'sketchup.rb'
require 'extensions.rb'

unless file_loaded?(__FILE__)
  extension = SketchupExtension.new('CJ · Калькулятор изделий', 'cj_calculator/main')
  extension.description = 'Калькулятор изделий и измерения выделенных деталей модели.'
  extension.version = '0.2.0'
  extension.creator = 'Concrete Jungle'
  Sketchup.register_extension(extension, true)
  file_loaded(__FILE__)
end
